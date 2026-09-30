-- Saved review copies and team mentions. Apply after workspace_team_access.
begin;
create table public.workspace_beta_versions (
 id uuid primary key,
 number bigint generated always as identity unique,
 title text not null check(length(btrim(title)) between 1 and 100),
 summary text not null default '' check(length(summary)<=2000),
 author_id uuid not null references auth.users(id),
 author_name text not null,
 created_at timestamptz not null default now(),
 content jsonb not null check(jsonb_typeof(content)='array')
);
create index workspace_beta_versions_author on public.workspace_beta_versions(author_id);
alter table public.workspace_beta_versions enable row level security;
revoke all on public.workspace_beta_versions from public,anon,authenticated;
grant select on public.workspace_beta_versions to authenticated;
create policy team_reads_beta_versions on public.workspace_beta_versions for select to authenticated using ((select public.workspace_role()) is not null);

create function aiwise_private.create_beta_version(p_id uuid,p_title text,p_summary text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); existing public.workspace_beta_versions; display text;
begin
 if actor is null or public.workspace_role() is distinct from 'admin' then raise exception 'Administrator access is required.' using errcode='42501';end if;
 if p_id is null or p_title is null or length(btrim(p_title)) not between 1 and 100 or p_summary is null or length(p_summary)>2000 then raise exception 'Enter a version name and a short summary.' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('beta-version:'||p_id::text,0));
 select * into existing from public.workspace_beta_versions where id=p_id;
 if found then
  if existing.author_id<>actor or existing.title<>btrim(p_title) or existing.summary<>p_summary then raise exception 'This version request changed. Refresh before trying again.' using errcode='22023';end if;
  return existing.id;
 end if;
 select left(coalesce(nullif(btrim(raw_user_meta_data->>'display_name'),''),'Team member'),80) into display from auth.users where id=actor;
 -- One statement observes one consistent content snapshot. Unapproved Dutch drafts are excluded.
 insert into public.workspace_beta_versions(id,title,summary,author_id,author_name,content)
 select p_id,btrim(p_title),p_summary,actor,display,jsonb_agg(jsonb_build_object('course',s.course,'chapter',s.chapter,'locale',s.locale,'slots',coalesce(b.slots,s.slots),'submission_id',b.submission_id) order by s.course,s.chapter,s.locale)
 from public.workspace_content_sources s left join public.workspace_beta_content b using(course,chapter,locale)
 where s.locale='en' or b.submission_id is not null;
 return p_id;
end $$;
revoke all on function aiwise_private.create_beta_version(uuid,text,text) from public,anon,authenticated;
grant execute on function aiwise_private.create_beta_version(uuid,text,text) to authenticated;
create function public.workspace_create_beta_version(p_id uuid,p_title text,p_summary text default '') returns uuid
language sql security invoker set search_path='' as $$select aiwise_private.create_beta_version(p_id,p_title,p_summary);$$;
revoke all on function public.workspace_create_beta_version(uuid,text,text) from public,anon,authenticated;
grant execute on function public.workspace_create_beta_version(uuid,text,text) to authenticated;

alter table public.workspace_beta_memos add column version_id uuid references public.workspace_beta_versions(id), add column mentions uuid[] not null default '{}';
alter table public.workspace_beta_replies add column mentions uuid[] not null default '{}';
create index workspace_beta_memos_version_page on public.workspace_beta_memos(version_id,page,created_at);
create index workspace_beta_memos_mentions on public.workspace_beta_memos using gin(mentions);
create index workspace_beta_replies_mentions on public.workspace_beta_replies using gin(mentions);
grant insert(version_id,mentions) on public.workspace_beta_memos to authenticated;
grant insert(mentions) on public.workspace_beta_replies to authenticated;

-- Approved teammates may select people by display name; no email directory is exposed.
create function aiwise_private.beta_people() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.workspace_role() is null then raise exception 'Active team membership required.' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'name',left(coalesce(nullif(btrim(u.raw_user_meta_data->>'display_name'),''),'Team member'),80)) order by u.id),'[]'::jsonb)
 from public.workspace_members m join auth.users u on u.id=m.user_id where m.active and u.deleted_at is null and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false));
end $$;
revoke all on function aiwise_private.beta_people() from public,anon,authenticated;
grant execute on function aiwise_private.beta_people() to authenticated;
create function public.workspace_beta_people() returns jsonb language sql security invoker set search_path='' as $$select aiwise_private.beta_people();$$;
revoke all on function public.workspace_beta_people() from public,anon,authenticated;
grant execute on function public.workspace_beta_people() to authenticated;

create function aiwise_private.validate_beta_mentions() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.workspace_role() is null then raise exception 'Active team membership required.' using errcode='42501';end if;
 if new.mentions is null or cardinality(new.mentions)>20 or exists(select 1 from unnest(new.mentions) person where person is null or not exists(select 1 from public.workspace_members m join auth.users u on u.id=m.user_id where m.user_id=person and m.active and u.deleted_at is null and u.email_confirmed_at is not null)) then
  raise exception 'Choose active teammates to mention (up to 20).' using errcode='23514';
 end if;
 select coalesce(array_agg(distinct person),'{}'::uuid[]) into new.mentions from unnest(new.mentions) person;
 return new;
end $$;
revoke all on function aiwise_private.validate_beta_mentions() from public,anon,authenticated;
create trigger beta_memo_mentions before insert on public.workspace_beta_memos for each row execute function aiwise_private.validate_beta_mentions();
create trigger beta_reply_mentions before insert on public.workspace_beta_replies for each row execute function aiwise_private.validate_beta_mentions();
notify pgrst,'reload schema';
commit;
