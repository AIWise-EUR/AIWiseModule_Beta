-- Version labels use the start of the publication cycle in Europe/Amsterdam.
-- Existing IDs, numbers, content, feedback and publication timestamps are preserved.
begin;
alter table public.workspace_beta_versions add column if not exists started_at timestamptz;
update public.workspace_beta_versions v set started_at=coalesce(
 (select p.published_at from public.workspace_beta_versions p where p.number<v.number and p.published_at is not null order by p.number desc limit 1),
 (select min(p.created_at) from public.workspace_beta_versions p where p.number<=v.number),v.created_at)
where v.started_at is null;
alter table public.workspace_beta_versions alter column started_at set not null;
update public.workspace_beta_versions set title='V'||number||'_'||to_char(started_at at time zone 'Europe/Amsterdam','YYYY-MM-DD') where id is not null;
update public.workspace_releases r set version_title=v.title from public.workspace_beta_versions v where r.version_id=v.id;
create or replace function aiwise_private.name_beta_version() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('beta-version-sequence',0));
 -- Use the next committed number; a failed transaction must not rename the working version.
 select coalesce(max(number),0)+1 into new.number from public.workspace_beta_versions;
 select coalesce((select published_at from public.workspace_beta_versions where published_at is not null order by number desc limit 1),
 (select min(created_at) from public.workspace_beta_versions),new.created_at) into new.started_at;
 new.title:='V'||new.number||'_'||to_char(new.started_at at time zone 'Europe/Amsterdam','YYYY-MM-DD');
 return new;
end $$;
revoke all on function aiwise_private.name_beta_version() from public,anon,authenticated;
drop trigger if exists name_beta_version on public.workspace_beta_versions;
create trigger name_beta_version before insert on public.workspace_beta_versions for each row execute function aiwise_private.name_beta_version();
notify pgrst,'reload schema';
commit;
