-- Apply after orientation_content_languages. Existing administrators are retained.
begin;
alter table public.workspace_members add column version bigint not null default 1 check(version>0);

create table aiwise_private.team_access_log (
 id bigint generated always as identity primary key,
 actor_id uuid not null, user_id uuid not null,
 previous_role text, previous_active boolean,
 new_role text not null, new_active boolean not null,
 member_version bigint not null, changed_at timestamptz not null default now()
);
alter table aiwise_private.team_access_log enable row level security;
revoke all on aiwise_private.team_access_log from public,anon,authenticated;

-- Auth users are read only inside this guarded function. No public user directory.
create function aiwise_private.list_team(p_search text,p_offset integer,p_limit integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or public.workspace_role() is distinct from 'admin' then
  raise exception 'Administrator permission is required.' using errcode='42501';
 end if;
 if p_search is null or length(p_search)>100 or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 then
  raise exception 'Invalid team search.' using errcode='22023';
 end if;
 with people as (
  select u.id user_id,u.email,left(coalesce(nullif(btrim(u.raw_user_meta_data->>'display_name'),''),'Unnamed account'),80) display_name,
   u.email_confirmed_at is not null confirmed,coalesce(m.role,'member') role,
   coalesce(m.active,false) active,coalesce(m.version,0) version,
   case when m.user_id is null then 'pending' when not m.active then 'inactive' else m.role end access,
   u.created_at
  from auth.users u left join public.workspace_members m on m.user_id=u.id
  where u.deleted_at is null and not coalesce(u.is_anonymous,false) and nullif(u.email,'') is not null
   and (p_search='' or strpos(lower(u.email),lower(p_search))>0 or strpos(lower(coalesce(u.raw_user_meta_data->>'display_name','')),lower(p_search))>0)
 ), page as (select * from people order by (access='pending') desc,created_at desc,user_id limit p_limit offset p_offset)
 select jsonb_build_object('members',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),
  'total',(select count(*) from people),'offset',p_offset,'limit',p_limit) into result;
 return result;
end $$;

create function aiwise_private.set_team_access(p_user_id uuid,p_role text,p_active boolean,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); previous public.workspace_members; result public.workspace_members; verified boolean;
begin
 -- Serialize membership changes, including simultaneous attempts to demote two admins.
 -- Recheck the caller AFTER acquiring the lock; a waiting caller may have lost access.
 lock table public.workspace_members in share row exclusive mode;
 if actor is null or public.workspace_role() is distinct from 'admin' then
  raise exception 'Administrator permission is required.' using errcode='42501';
 end if;
 if p_user_id is null or p_role is null or p_role not in ('admin','member') or p_active is null or p_expected_version is null or p_expected_version<0 then
  raise exception 'Choose a valid role and access setting.' using errcode='22023';
 end if;
 select email_confirmed_at is not null into verified from auth.users
  where id=p_user_id and deleted_at is null and not coalesce(is_anonymous,false) and nullif(email,'') is not null;
 if not found then raise exception 'This account is no longer available.' using errcode='22023'; end if;
 if p_active and not verified then raise exception 'This person must confirm their email first.' using errcode='22023'; end if;
 select * into previous from public.workspace_members where user_id=p_user_id;
 if coalesce(previous.version,0)<>p_expected_version then
  raise exception 'This person’s access changed. Refresh the team list and try again.' using errcode='40001';
 end if;
 if previous.active and previous.role='admin' and (not p_active or p_role<>'admin') and
  (select count(*) from public.workspace_members where active and role='admin')<=1 then
  raise exception 'Keep at least one active administrator. Add another administrator first.' using errcode='23514';
 end if;
 if previous.role=p_role and previous.active=p_active then return to_jsonb(previous); end if;
 insert into public.workspace_members(user_id,role,active,version) values(p_user_id,p_role,p_active,1)
 on conflict(user_id) do update set role=excluded.role,active=excluded.active,version=workspace_members.version+1
 returning * into result;
 insert into aiwise_private.team_access_log(actor_id,user_id,previous_role,previous_active,new_role,new_active,member_version)
 values(actor,p_user_id,previous.role,previous.active,p_role,p_active,result.version);
 return to_jsonb(result);
end $$;

revoke all on function aiwise_private.list_team(text,integer,integer),aiwise_private.set_team_access(uuid,text,boolean,bigint) from public,anon,authenticated;
grant usage on schema aiwise_private to authenticated;
grant execute on function aiwise_private.list_team(text,integer,integer),aiwise_private.set_team_access(uuid,text,boolean,bigint) to authenticated;
create function public.workspace_list_team(p_search text default '',p_offset integer default 0,p_limit integer default 50)
returns jsonb language sql security invoker set search_path='' as $$ select aiwise_private.list_team(p_search,p_offset,p_limit); $$;
create function public.workspace_set_team_access(p_user_id uuid,p_role text,p_active boolean,p_expected_version bigint)
returns jsonb language sql security invoker set search_path='' as $$ select aiwise_private.set_team_access(p_user_id,p_role,p_active,p_expected_version); $$;
revoke all on function public.workspace_list_team(text,integer,integer),public.workspace_set_team_access(uuid,text,boolean,bigint) from public,anon,authenticated;
grant execute on function public.workspace_list_team(text,integer,integer),public.workspace_set_team_access(uuid,text,boolean,bigint) to authenticated;
-- No direct enrollment, privilege escalation or membership edits from the browser.
revoke insert,update,delete on public.workspace_members from anon,authenticated;

drop policy team_reads_submissions on public.workspace_submissions;
create policy admin_reads_submissions on public.workspace_submissions for select to authenticated
 using ((select public.workspace_role())='admin');
drop policy beta_memo_resolve on public.workspace_beta_memos;
create policy beta_memo_resolve on public.workspace_beta_memos for update to authenticated
 using ((select public.workspace_role())='admin') with check ((select public.workspace_role())='admin');

-- Members keep Beta comment/reply INSERT and SELECT policies. Approved module
-- copy stays publicly readable because GitHub Pages still serves the module.

create or replace function aiwise_private.submit_localized_content(
 p_client_id uuid,p_course text,p_chapter text,p_slots jsonb,p_base_slots jsonb,
 p_base_release uuid,p_saved_at timestamptz,p_summary text,p_locale text,p_source_release uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); existing public.workspace_submissions; baseline jsonb; current_release uuid; result uuid; author text; english_release uuid;
begin
 if auth.uid() is null or public.workspace_role() is distinct from 'admin' then raise exception 'Administrator permission is required.' using errcode='42501'; end if;
 if p_locale is null or p_locale not in ('en','nl') then raise exception 'Unsupported content language.'; end if;
 if p_client_id is null then raise exception 'A submission ID is required.'; end if;
 -- Serialize retries per account and client ID before the idempotency lookup.
 perform pg_advisory_xact_lock(hashtextextended(uid::text || p_client_id::text,0));
 select * into existing from public.workspace_submissions where author_id=uid and client_id=p_client_id;
 if found then
  if existing.locale is distinct from p_locale or existing.source_release is distinct from p_source_release or existing.course is distinct from p_course or existing.chapter is distinct from p_chapter or existing.slots is distinct from p_slots then raise exception 'Submission ID already belongs to another content copy.'; end if;
  return existing.id;
 end if;
 if p_locale='nl' then
  perform pg_advisory_xact_lock(hashtextextended('aiwise-beta:' || p_course || ':' || p_chapter || ':en',0));
  select submission_id into english_release from public.workspace_beta_content where course=p_course and chapter=p_chapter and locale='en';
  if english_release is distinct from p_source_release then raise exception 'English source changed. Review the latest source before submitting.'; end if;
 elsif p_source_release is not null then raise exception 'English content cannot reference a translation source.';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('aiwise-beta:' || p_course || ':' || p_chapter || ':' || p_locale,0));
 select slots into baseline from public.workspace_content_sources where course=p_course and chapter=p_chapter and locale=p_locale;
 if baseline is null then raise exception 'Unsupported course or chapter.'; end if;
 select submission_id,slots into current_release,baseline from public.workspace_beta_content where course=p_course and chapter=p_chapter and locale=p_locale;
 if not found then select slots into baseline from public.workspace_content_sources where course=p_course and chapter=p_chapter and locale=p_locale; end if;
 if current_release is distinct from p_base_release or baseline is distinct from p_base_slots then raise exception 'Beta has changed. Reload Studio and reapply your edits before submitting.'; end if;
 if p_slots is null or octet_length(p_slots::text)>2000000 or not public.workspace_valid_content(p_slots,baseline) then raise exception 'The submitted content does not match the supported slot structure.'; end if;
 if p_saved_at is null or p_summary is null or length(btrim(p_summary)) not between 1 and 12000 then raise exception 'A saved draft and change summary are required.'; end if;
 select coalesce(nullif(left(btrim(raw_user_meta_data->>'display_name'),80),''),'Team member') into author from auth.users where id=uid;
 insert into public.workspace_submissions(client_id,course,chapter,author_id,author_name,summary,slots,base_slots,base_release,saved_at,locale,source_release,catalog_version)
 values(p_client_id,p_course,p_chapter,uid,author,btrim(p_summary),p_slots,p_base_slots,p_base_release,p_saved_at,p_locale,p_source_release,2) returning id into result;
 return result;
end;
$$;


notify pgrst,'reload schema';
commit;
