-- Apply AFTER the queue migration and deployment of github-publish (Verify JWT OFF).
-- Enables automatic Beta commits. Does not publish to the student repository.
begin;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
do $$
declare secret text;
begin
 select decrypted_secret into secret from vault.decrypted_secrets where name='aiwise_github_worker';
 if secret is null then
  secret=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
  perform vault.create_secret(secret,'aiwise_github_worker','Authenticates the approved-content commit worker');
 end if;
 update aiwise_private.github_settings set worker_secret_hash=sha256(convert_to(secret,'UTF8')),enabled=true where singleton;
end;
$$;
create or replace function aiwise_private.kick_github_worker() returns void
language plpgsql security definer set search_path='' as $$
declare secret text;
begin
 if not (select enabled from aiwise_private.github_settings where singleton) then return; end if;
 if not exists(select 1 from public.workspace_github_jobs where
  (status='queued' and available_at<=now()) or (status='processing' and lease_until<=now()) or
  (status='committed' and deployment_status in ('pending','building') and (deployment_checked_at is null or deployment_checked_at<now()-interval '1 minute')))
 then return; end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='aiwise_github_worker';
 if secret is null then return; end if;
 perform net.http_post(
  url:='https://cvcvdiohckwgpgoxibia.supabase.co/functions/v1/github-publish',
  headers:=jsonb_build_object('Content-Type','application/json','x-aiwise-worker',secret),
  body:='{}'::jsonb,timeout_milliseconds:=120000);
end;
$$;
revoke all on function aiwise_private.kick_github_worker() from public,anon,authenticated;
-- pg_net starts requests after the transaction commits. Cron recovers interrupted calls.
create or replace function aiwise_private.kick_github_after_enqueue() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform aiwise_private.kick_github_worker();
 return new;
exception when others then return new; -- Queued work survives and cron retries; approval is not lost.
end;
$$;
revoke all on function aiwise_private.kick_github_after_enqueue() from public,anon,authenticated;
drop trigger if exists workspace_start_github_worker on public.workspace_github_jobs;
create trigger workspace_start_github_worker after insert on public.workspace_github_jobs
 for each statement execute function aiwise_private.kick_github_after_enqueue();
select cron.schedule('aiwise-github-publish','* * * * *','select aiwise_private.kick_github_worker();');
select aiwise_private.kick_github_worker();
commit;
