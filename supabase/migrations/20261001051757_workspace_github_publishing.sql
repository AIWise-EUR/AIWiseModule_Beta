-- Durable approved-content outbox. No GitHub credentials enter the browser.
begin;
create table aiwise_private.github_settings (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 worker_secret_hash bytea
);
insert into aiwise_private.github_settings(singleton) values(true);
alter table aiwise_private.github_settings enable row level security;
revoke all on aiwise_private.github_settings from public,anon,authenticated;
grant usage on schema aiwise_private to service_role;
grant select on aiwise_private.github_settings to service_role;

create table public.workspace_github_jobs (
 sequence bigint generated always as identity primary key,
 submission_id uuid not null unique references public.workspace_submissions(id),
 course text not null, chapter text not null, locale text not null,
 payload jsonb not null,
 status text not null default 'queued' check(status in ('queued','processing','committed','failed','superseded')),
 attempts integer not null default 0,
 available_at timestamptz not null default now(),
 lease_token uuid, lease_until timestamptz,
 commit_sha text check(commit_sha ~ '^[a-f0-9]{40}$'),
 error_code text,
 deployment_status text not null default 'pending' check(deployment_status in ('pending','building','success','failure','unknown')),
 deployment_run_id bigint,
 deployment_checked_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index workspace_github_jobs_pending on public.workspace_github_jobs(available_at,sequence) where status in ('queued','processing');
create index workspace_github_jobs_deployment on public.workspace_github_jobs(deployment_checked_at) where status='committed' and deployment_status in ('pending','building');
alter table public.workspace_github_jobs enable row level security;
revoke all on public.workspace_github_jobs from public,anon,authenticated;
grant select(sequence,submission_id,course,chapter,locale,status,attempts,commit_sha,error_code,deployment_status,deployment_run_id,created_at,updated_at) on public.workspace_github_jobs to authenticated;
grant all on public.workspace_github_jobs to service_role;
grant usage,select on sequence public.workspace_github_jobs_sequence_seq to service_role;
create policy admins_read_github_jobs on public.workspace_github_jobs for select to authenticated using((select public.workspace_role())='admin');

create function aiwise_private.queue_github_content() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' and new.submission_id=old.submission_id then return new; end if;
 insert into public.workspace_github_jobs(submission_id,course,chapter,locale,payload)
 values(new.submission_id,new.course,new.chapter,new.locale,
  jsonb_build_object('schema',1,'course',new.course,'chapter',new.chapter,'locale',new.locale,
   'submission_id',new.submission_id,'source_release',new.source_release,'approved_at',new.approved_at,'slots',new.slots))
 on conflict(submission_id) do nothing;
 return new;
end;
$$;
revoke all on function aiwise_private.queue_github_content() from public,anon,authenticated;
create trigger workspace_queue_github after insert or update on public.workspace_beta_content
 for each row execute function aiwise_private.queue_github_content();
-- Backfill only currently approved copies, never pending submissions or private feedback.
insert into public.workspace_github_jobs(submission_id,course,chapter,locale,payload)
 select submission_id,course,chapter,locale,jsonb_build_object('schema',1,'course',course,'chapter',chapter,'locale',locale,
 'submission_id',submission_id,'source_release',source_release,'approved_at',approved_at,'slots',slots)
 from public.workspace_beta_content order by approved_at,course,chapter,locale;

create function public.workspace_github_check_worker(p_secret text) returns boolean
language sql stable security invoker set search_path='' as $$
 select coalesce((select enabled and length(p_secret)=64 and worker_secret_hash=sha256(convert_to(p_secret,'UTF8'))
 from aiwise_private.github_settings where singleton),false);
$$;
create function public.workspace_github_claim() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare job public.workspace_github_jobs;
begin
 perform pg_advisory_xact_lock(hashtextextended('aiwise-github-worker',0));
 if not (select enabled from aiwise_private.github_settings where singleton) then return null; end if;
 if exists(select 1 from public.workspace_github_jobs where status='processing' and lease_until>now()) then return null; end if;
 update public.workspace_github_jobs set status='failed',error_code='retry_limit',updated_at=now()
 where status='processing' and lease_until<=now() and attempts>=8;
 select * into job from public.workspace_github_jobs
 where (status='queued' and available_at<=now()) or (status='processing' and lease_until<=now())
 order by sequence limit 1 for update;
 if not found then return null; end if;
 update public.workspace_github_jobs set status='processing',attempts=attempts+1,lease_token=gen_random_uuid(),
 lease_until=now()+interval '3 minutes',updated_at=now() where sequence=job.sequence returning * into job;
 return to_jsonb(job);
end;
$$;
create function public.workspace_github_lease_valid(p_sequence bigint,p_lease uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.workspace_github_jobs j,aiwise_private.github_settings s
 where s.enabled and j.sequence=p_sequence and j.lease_token=p_lease and j.status='processing' and j.lease_until>now());
$$;
create function public.workspace_github_finish(p_sequence bigint,p_lease uuid,p_sha text,p_error text,p_superseded boolean default false) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 if p_error is not null and p_error !~ '^[a-z0-9_]{1,80}$' then raise exception 'Invalid error code'; end if;
 if p_error is null and not p_superseded and (p_sha is null or p_sha !~ '^[a-f0-9]{40}$') then raise exception 'Commit required'; end if;
 update public.workspace_github_jobs set
 status=case when p_error is not null then case when attempts>=8 then 'failed' else 'queued' end when p_superseded then 'superseded' else 'committed' end,
 commit_sha=p_sha,error_code=p_error,lease_token=null,lease_until=null,
 available_at=now()+make_interval(secs=>least(3600,power(2,attempts)::integer*15)),updated_at=now()
 where sequence=p_sequence and lease_token=p_lease and status='processing';
 return found;
end;
$$;
revoke all on function public.workspace_github_check_worker(text),public.workspace_github_claim(),public.workspace_github_lease_valid(bigint,uuid),public.workspace_github_finish(bigint,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.workspace_github_check_worker(text),public.workspace_github_claim(),public.workspace_github_lease_valid(bigint,uuid),public.workspace_github_finish(bigint,uuid,text,text,boolean) to service_role;

create function aiwise_private.github_status() returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 if public.workspace_role() is distinct from 'admin' then raise exception 'Administrator required' using errcode='42501'; end if;
 return (select enabled from aiwise_private.github_settings where singleton);
end;
$$;
create function public.workspace_github_status() returns boolean language sql security invoker set search_path='' as $$select aiwise_private.github_status();$$;
create function aiwise_private.retry_github(p_submission uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if public.workspace_role() is distinct from 'admin' then raise exception 'Administrator required' using errcode='42501'; end if;
 update public.workspace_github_jobs set status='queued',attempts=0,available_at=now(),error_code=null,updated_at=now()
 where submission_id=p_submission and status='failed';
 if not found then raise exception 'Only failed commits can be retried.'; end if;
end;
$$;
create function public.workspace_retry_github(p_submission uuid) returns void language sql security invoker set search_path='' as $$select aiwise_private.retry_github(p_submission);$$;
revoke all on function aiwise_private.github_status(),public.workspace_github_status(),aiwise_private.retry_github(uuid),public.workspace_retry_github(uuid) from public,anon,authenticated;
grant execute on function aiwise_private.github_status(),public.workspace_github_status(),aiwise_private.retry_github(uuid),public.workspace_retry_github(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
