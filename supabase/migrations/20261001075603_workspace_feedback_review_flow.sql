-- Workspace feedback inbox and immutable-version review checklist. No publishing or role changes.
begin;
create table public.workspace_page_feedback (
 id uuid primary key, author_id uuid not null references auth.users(id), author_name text not null,
 page text not null check(length(page) between 1 and 1200 and page ~ '^workspace/(course-profiler/)?#[a-zA-Z0-9_/?=&%~.:-]*$'),
 page_title text not null check(length(page_title) between 1 and 160),
 kind text not null check(kind in ('bug','idea','improvement')),
 body text not null check(length(btrim(body)) between 1 and 8000),
 status text not null default 'new' check(status in ('new','reviewing','done')),
 response text not null default '' check(length(response)<=8000),
 administrator_name text, revision integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index workspace_page_feedback_author on public.workspace_page_feedback(author_id,created_at desc);
create index workspace_page_feedback_status on public.workspace_page_feedback(status,created_at desc);
alter table public.workspace_page_feedback enable row level security;
revoke all on public.workspace_page_feedback from public,anon,authenticated;
grant select on public.workspace_page_feedback to authenticated;
create policy page_feedback_read on public.workspace_page_feedback for select to authenticated
 using ((select public.workspace_role())='admin' or ((select public.workspace_role())='member' and author_id=(select auth.uid())));
create function aiwise_private.send_page_feedback(p_id uuid,p_page text,p_title text,p_kind text,p_body text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); old public.workspace_page_feedback; display text;
begin
 if actor is null or public.workspace_role() is null then raise exception 'Active team access required.' using errcode='42501';end if;
 if p_id is null or p_body is null or p_page is null or p_title is null or p_kind is null then raise exception 'Complete the feedback form.' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('page-feedback:'||p_id::text,0));
 select * into old from public.workspace_page_feedback where id=p_id;
 if found then
  if old.author_id<>actor or old.page<>p_page or old.page_title<>p_title or old.kind<>p_kind or old.body<>btrim(p_body) then raise exception 'Feedback request changed.' using errcode='22023';end if;
  return old.id;
 end if;
 select left(coalesce(nullif(btrim(raw_user_meta_data->>'display_name'),''),'Team member'),80) into display from auth.users where id=actor;
 insert into public.workspace_page_feedback(id,author_id,author_name,page,page_title,kind,body) values(p_id,actor,display,p_page,p_title,p_kind,btrim(p_body));
 return p_id;
end $$;
create function public.workspace_send_page_feedback(p_id uuid,p_page text,p_title text,p_kind text,p_body text) returns uuid
language sql security invoker set search_path='' as $$select aiwise_private.send_page_feedback(p_id,p_page,p_title,p_kind,p_body);$$;
create function aiwise_private.update_page_feedback(p_id uuid,p_revision integer,p_status text,p_response text) returns void
language plpgsql security definer set search_path='' as $$
declare display text;
begin
 if auth.uid() is null or public.workspace_role() is distinct from 'admin' then raise exception 'Administrator access required.' using errcode='42501';end if;
 select left(coalesce(nullif(btrim(raw_user_meta_data->>'display_name'),''),'Team member'),80) into display from auth.users where id=auth.uid();
 update public.workspace_page_feedback set status=p_status,response=p_response,administrator_name=display,revision=revision+1,updated_at=clock_timestamp() where id=p_id and revision=p_revision;
 if not found then raise exception 'Feedback changed. Refresh and retry.' using errcode='40001';end if;
end $$;
create function public.workspace_update_page_feedback(p_id uuid,p_revision integer,p_status text,p_response text) returns void
language sql security invoker set search_path='' as $$select aiwise_private.update_page_feedback(p_id,p_revision,p_status,p_response);$$;

create table public.workspace_beta_checks (
 version_id uuid not null references public.workspace_beta_versions(id), course text not null,chapter text not null,locale text not null,item_key text not null,
 reviewed boolean not null,reviewer_id uuid not null references auth.users(id),reviewer_name text not null,updated_at timestamptz not null default clock_timestamp(),
 primary key(version_id,course,chapter,locale,item_key)
);
create index workspace_beta_checks_reviewer on public.workspace_beta_checks(reviewer_id);
alter table public.workspace_beta_checks enable row level security;
revoke all on public.workspace_beta_checks from public,anon,authenticated;
grant select on public.workspace_beta_checks to authenticated;
create policy beta_checks_read on public.workspace_beta_checks for select to authenticated using ((select public.workspace_role()) is not null);

-- Serialize version creation so a later commit cannot insert an earlier comparison version.
create or replace function aiwise_private.create_beta_version(p_id uuid,p_title text,p_summary text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); existing public.workspace_beta_versions; display text;
begin
 if actor is null or public.workspace_role() is distinct from 'admin' then raise exception 'Administrator access is required.' using errcode='42501';end if;
 if p_id is null or p_title is null or length(btrim(p_title)) not between 1 and 100 or p_summary is null or length(p_summary)>2000 then raise exception 'Enter a version name and a short summary.' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('beta-version-sequence',0));
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

-- The previous saved version is the fixed comparison baseline. For the first version, every item needs an initial review.
create function aiwise_private.beta_review_context(p_version uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare current_copy jsonb; previous_copy jsonb; selected public.workspace_beta_versions; previous public.workspace_beta_versions; changes jsonb; checks jsonb; open_count integer;
begin
 if auth.uid() is null or public.workspace_role() is null then raise exception 'Active team access required.' using errcode='42501';end if;
 if p_version is not null then
  select * into selected from public.workspace_beta_versions where id=p_version;
  if not found then raise exception 'Review version unavailable.' using errcode='22023';end if;
  current_copy:=selected.content;
  select * into previous from public.workspace_beta_versions where number<selected.number order by number desc limit 1;
 else
  select jsonb_agg(jsonb_build_object('course',s.course,'chapter',s.chapter,'locale',s.locale,'slots',coalesce(b.slots,s.slots))) into current_copy
   from public.workspace_content_sources s left join public.workspace_beta_content b using(course,chapter,locale) where s.locale='en' or b.submission_id is not null;
  select * into previous from public.workspace_beta_versions order by number desc limit 1;
 end if;
 previous_copy:=coalesce(previous.content,'[]'::jsonb);
 with scopes as (
  select v->>'course' course,v->>'chapter' chapter,v->>'locale' locale from jsonb_array_elements(current_copy||previous_copy) v group by 1,2,3
 ), copies as (
  select s.*,a.v new_row,b.v old_row from scopes s
  left join lateral (select n.value v from jsonb_array_elements(current_copy) n(value) where n.value->>'course'=s.course and n.value->>'chapter'=s.chapter and (n.value->>'locale'=s.locale or n.value->>'locale'='en') order by (n.value->>'locale'=s.locale) desc limit 1) a on true
  left join lateral (select o.value v from jsonb_array_elements(previous_copy) o(value) where o.value->>'course'=s.course and o.value->>'chapter'=s.chapter and (o.value->>'locale'=s.locale or o.value->>'locale'='en') order by (o.value->>'locale'=s.locale) desc limit 1) b on true
 ), differences as (
  select c.course,c.chapter,c.locale,k.key,old_row->'slots'->k.key before,new_row->'slots'->k.key after,
   case when previous.id is null then 'initial' when new_row->'slots'->k.key is null then 'removed' when old_row->'slots'->k.key is null then 'added' else 'changed' end kind
  from copies c cross join lateral (select jsonb_object_keys(coalesce(old_row->'slots','{}')||coalesce(new_row->'slots','{}')) key) k
  where (old_row->'slots'->k.key) is distinct from (new_row->'slots'->k.key) or old_row->>'locale' is distinct from new_row->>'locale'
 ) select coalesce(jsonb_agg(to_jsonb(d) order by course,chapter,locale,key),'[]') into changes from differences d;
 select coalesce(jsonb_agg(to_jsonb(c)),'[]') into checks from public.workspace_beta_checks c where version_id=p_version;
 select count(*) into open_count from public.workspace_beta_memos where version_id is not distinct from p_version and not resolved;
 return jsonb_build_object('version_id',p_version,'previous_number',previous.number,'previous_title',previous.title,'changes',changes,'checks',checks,'open_memos',open_count);
end $$;
create function public.workspace_beta_review_context(p_version uuid default null) returns jsonb
language sql stable security invoker set search_path='' as $$select aiwise_private.beta_review_context(p_version);$$;
create function aiwise_private.check_beta_item(p_version uuid,p_course text,p_chapter text,p_locale text,p_key text,p_reviewed boolean,p_expected timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); old public.workspace_beta_checks; display text; context jsonb;
begin
 if actor is null or public.workspace_role() is null then raise exception 'Active team access required.' using errcode='42501';end if;
 if p_version is null or p_reviewed is null then raise exception 'Choose a saved review version.' using errcode='22023';end if;
 context:=aiwise_private.beta_review_context(p_version);
 if not exists(select 1 from jsonb_array_elements(context->'changes') c where c->>'course'=p_course and c->>'chapter'=p_chapter and c->>'locale'=p_locale and c->>'key'=p_key) then raise exception 'This item is not in the review checklist.' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('beta-check:'||p_version::text||':'||p_course||':'||p_chapter||':'||p_locale||':'||p_key,0));
 select * into old from public.workspace_beta_checks where version_id=p_version and course=p_course and chapter=p_chapter and locale=p_locale and item_key=p_key;
 if old.updated_at is distinct from p_expected then raise exception 'Review status changed. Refresh and retry.' using errcode='40001';end if;
 select left(coalesce(nullif(btrim(raw_user_meta_data->>'display_name'),''),'Team member'),80) into display from auth.users where id=actor;
 insert into public.workspace_beta_checks(version_id,course,chapter,locale,item_key,reviewed,reviewer_id,reviewer_name) values(p_version,p_course,p_chapter,p_locale,p_key,p_reviewed,actor,display)
 on conflict(version_id,course,chapter,locale,item_key) do update set reviewed=excluded.reviewed,reviewer_id=excluded.reviewer_id,reviewer_name=excluded.reviewer_name,updated_at=clock_timestamp();
end $$;
create function public.workspace_check_beta_item(p_version uuid,p_course text,p_chapter text,p_locale text,p_key text,p_reviewed boolean,p_expected timestamptz default null) returns void
language sql security invoker set search_path='' as $$select aiwise_private.check_beta_item(p_version,p_course,p_chapter,p_locale,p_key,p_reviewed,p_expected);$$;
revoke all on function aiwise_private.send_page_feedback(uuid,text,text,text,text),public.workspace_send_page_feedback(uuid,text,text,text,text),aiwise_private.update_page_feedback(uuid,integer,text,text),public.workspace_update_page_feedback(uuid,integer,text,text),aiwise_private.beta_review_context(uuid),public.workspace_beta_review_context(uuid),aiwise_private.check_beta_item(uuid,text,text,text,text,boolean,timestamptz),public.workspace_check_beta_item(uuid,text,text,text,text,boolean,timestamptz) from public,anon,authenticated;
grant execute on function aiwise_private.send_page_feedback(uuid,text,text,text,text),public.workspace_send_page_feedback(uuid,text,text,text,text),aiwise_private.update_page_feedback(uuid,integer,text,text),public.workspace_update_page_feedback(uuid,integer,text,text),aiwise_private.beta_review_context(uuid),public.workspace_beta_review_context(uuid),aiwise_private.check_beta_item(uuid,text,text,text,text,boolean,timestamptz),public.workspace_check_beta_item(uuid,text,text,text,text,boolean,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
