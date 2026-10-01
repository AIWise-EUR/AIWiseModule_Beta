-- Prepared, immutable releases require a separate administrator Publish approval.
begin;
create table aiwise_private.release_settings(singleton boolean primary key default true check(singleton),enabled boolean not null default false,worker_secret_hash bytea);
insert into aiwise_private.release_settings(singleton) values(true);
alter table aiwise_private.release_settings enable row level security;
revoke all on aiwise_private.release_settings from public,anon,authenticated;
grant select on aiwise_private.release_settings to service_role;
create table public.workspace_releases(
 id uuid primary key, number bigint generated always as identity unique,
 version_id uuid not null references public.workspace_beta_versions(id),
 version_number bigint not null, version_title text not null,
 author_id uuid not null references auth.users(id), approved_by uuid references auth.users(id),
 source_sha text not null check(source_sha~'^[a-f0-9]{40}$'),target_sha text not null check(target_sha~'^[a-f0-9]{40}$'),
 files jsonb not null check(jsonb_typeof(files)='object'),
 status text not null default 'prepared' check(status in ('prepared','queued','processing','committed','failed')),
 attempts integer not null default 0, available_at timestamptz not null default now(),lease_token uuid,lease_until timestamptz,
 commit_sha text check(commit_sha~'^[a-f0-9]{40}$'),error_code text,
 deployment_status text not null default 'pending' check(deployment_status in ('pending','building','success','failure','unknown')),
 deployment_run_id bigint,deployment_checked_at timestamptz,
 created_at timestamptz not null default now(),approved_at timestamptz,updated_at timestamptz not null default now()
);
create index workspace_releases_author on public.workspace_releases(author_id);
create index workspace_releases_approver on public.workspace_releases(approved_by);
create index workspace_releases_version on public.workspace_releases(version_id);
create index workspace_releases_queue on public.workspace_releases(available_at,number) where status in ('queued','processing');
alter table public.workspace_releases enable row level security;
revoke all on public.workspace_releases from public,anon,authenticated;
grant select(id,number,version_id,version_number,version_title,source_sha,target_sha,status,attempts,commit_sha,error_code,deployment_status,deployment_run_id,created_at,approved_at,updated_at) on public.workspace_releases to authenticated;
grant all on public.workspace_releases to service_role;
grant usage,select on sequence public.workspace_releases_number_seq to service_role;
grant select on public.workspace_beta_versions,public.workspace_members to service_role;
create policy admins_read_releases on public.workspace_releases for select to authenticated using((select public.workspace_role())='admin');
create function public.workspace_store_release(p_id uuid,p_version uuid,p_author uuid,p_source text,p_target text,p_files jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare existing public.workspace_releases; v public.workspace_beta_versions; k text; val jsonb;
begin
 if not exists(select 1 from public.workspace_members where user_id=p_author and active and role='admin') then raise exception 'Administrator required';end if;
 perform pg_advisory_xact_lock(hashtextextended('release-prepare:'||p_id::text,0));
 select * into existing from public.workspace_releases where id=p_id;
 if found then
  if existing.version_id<>p_version or existing.author_id<>p_author then raise exception 'Release identity changed';end if;
  return existing.id;
 end if;
 select * into v from public.workspace_beta_versions where id=p_version;
 if not found then raise exception 'Saved review version required';end if;
 if p_files is null or jsonb_typeof(p_files)<>'object' or octet_length(p_files::text)>4000000 then raise exception 'Invalid release files';end if;
 for k,val in select * from jsonb_each(p_files) loop
  if k not in ('aiwise-c1-final.html','aiwise-c2-final.html','aiwise-c3-final.html','aiwise-c1-anatomy-2d.html','published-content.json','published-content.js','published-common-content.js','published-course-loader.js','published-content-language.js','published-ui-effects.js','published-feedback-widget.js') or jsonb_typeof(val)<>'string' then raise exception 'Unsupported release file';end if;
 end loop;
 if (select count(*) from jsonb_object_keys(p_files))<>11 then raise exception 'Incomplete release';end if;
 insert into public.workspace_releases(id,version_id,version_number,version_title,author_id,source_sha,target_sha,files)
 values(p_id,p_version,v.number,v.title,p_author,p_source,p_target,p_files);return p_id;
end;$$;
create function aiwise_private.release_status() returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 if public.workspace_role() is distinct from 'admin' then raise exception 'Administrator required' using errcode='42501';end if;
 return (select enabled from aiwise_private.release_settings where singleton);
end;$$;
create function public.workspace_release_status() returns boolean language sql security invoker set search_path='' as $$select aiwise_private.release_status();$$;
create function aiwise_private.approve_release(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.workspace_releases;
begin
 if public.workspace_role() is distinct from 'admin' then raise exception 'Administrator required' using errcode='42501';end if;
 if not (select enabled from aiwise_private.release_settings where singleton) then raise exception 'Publishing is not enabled';end if;
 select * into r from public.workspace_releases where id=p_id for update;
 if not found then raise exception 'Release not found';end if;
 if r.status in ('queued','processing','committed') then return;end if;
 if r.status<>'prepared' then raise exception 'Prepare a new release or retry the failed commit';end if;
 update public.workspace_releases set status='queued',approved_by=auth.uid(),approved_at=now(),updated_at=now() where id=p_id;
end;$$;
create function public.workspace_approve_release(p_id uuid) returns void language sql security invoker set search_path='' as $$select aiwise_private.approve_release(p_id);$$;
create function aiwise_private.retry_release(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if public.workspace_role() is distinct from 'admin' then raise exception 'Administrator required' using errcode='42501';end if;
 update public.workspace_releases set status='queued',attempts=0,available_at=now(),error_code=null,updated_at=now()
 where id=p_id and status='failed' and error_code is distinct from 'published_changed';
 if not found then raise exception 'Prepare a new release against the current student site';end if;
end;$$;
create function public.workspace_retry_release(p_id uuid) returns void language sql security invoker set search_path='' as $$select aiwise_private.retry_release(p_id);$$;
revoke all on function aiwise_private.release_status(),public.workspace_release_status(),aiwise_private.approve_release(uuid),public.workspace_approve_release(uuid),aiwise_private.retry_release(uuid),public.workspace_retry_release(uuid) from public,anon,authenticated;
grant execute on function aiwise_private.release_status(),public.workspace_release_status(),aiwise_private.approve_release(uuid),public.workspace_approve_release(uuid),aiwise_private.retry_release(uuid),public.workspace_retry_release(uuid) to authenticated;
create function public.workspace_release_check_worker(p_secret text) returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce((select enabled and length(p_secret)=64 and worker_secret_hash=sha256(convert_to(p_secret,'UTF8')) from aiwise_private.release_settings where singleton),false);
$$;
create function public.workspace_release_claim() returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.workspace_releases;
begin
 perform pg_advisory_xact_lock(hashtextextended('aiwise-release-worker',0));
 if not (select enabled from aiwise_private.release_settings where singleton) then return null;end if;
 if exists(select 1 from public.workspace_releases where status='processing' and lease_until>now()) then return null;end if;
 update public.workspace_releases set status='failed',error_code='retry_limit',updated_at=now() where status='processing' and lease_until<=now() and attempts>=8;
 select * into r from public.workspace_releases where (status='queued' and available_at<=now()) or (status='processing' and lease_until<=now()) order by approved_at,number limit 1 for update;
 if not found then return null;end if;
 update public.workspace_releases set status='processing',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '3 minutes',updated_at=now() where id=r.id returning * into r;return to_jsonb(r);
end;$$;
create function public.workspace_release_lease_valid(p_id uuid,p_lease uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.workspace_releases r,aiwise_private.release_settings s where s.enabled and r.id=p_id and r.lease_token=p_lease and r.status='processing' and r.lease_until>now());
$$;
create function public.workspace_release_finish(p_id uuid,p_lease uuid,p_sha text,p_error text) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if p_error is not null and p_error !~ '^[a-z0-9_]{1,80}$' then raise exception 'Invalid error code';end if;
 if p_error is null and (p_sha is null or p_sha !~ '^[a-f0-9]{40}$') then raise exception 'Commit required';end if;
 update public.workspace_releases set status=case when p_error is null then 'committed' when p_error='published_changed' or attempts>=8 then 'failed' else 'queued' end,
 commit_sha=p_sha,error_code=p_error,lease_token=null,lease_until=null,available_at=now()+make_interval(secs=>least(3600,power(2,attempts)::integer*15)),updated_at=now()
 where id=p_id and lease_token=p_lease and status='processing';return found;
end;$$;
revoke all on function public.workspace_store_release(uuid,uuid,uuid,text,text,jsonb),public.workspace_release_check_worker(text),public.workspace_release_claim(),public.workspace_release_lease_valid(uuid,uuid),public.workspace_release_finish(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.workspace_store_release(uuid,uuid,uuid,text,text,jsonb),public.workspace_release_check_worker(text),public.workspace_release_claim(),public.workspace_release_lease_valid(uuid,uuid),public.workspace_release_finish(uuid,uuid,text,text) to service_role;
notify pgrst,'reload schema';
commit;
