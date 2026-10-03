-- Content is stored per scope: Common, or one bachelor whose courses share its orientation examples.
-- The earlier course scopes become bachelors (aws1 -> psychology, ped -> pedagogical-sciences) and
-- "other" is retired. Saved versions, releases and commit jobs keep the ids they were frozen with.
begin;
create table public.workspace_content_scopes (
 id text primary key check (id ~ '^[a-z][a-z0-9-]{0,39}$'),
 kind text not null check (kind in ('common','bachelor')),
 name text not null check (length(btrim(name)) between 1 and 80),
 retired boolean not null default false
);
alter table public.workspace_content_scopes enable row level security;
revoke all on public.workspace_content_scopes from public,anon,authenticated;
grant select on public.workspace_content_scopes to anon,authenticated;
grant all on public.workspace_content_scopes to service_role;
create policy content_scopes_read on public.workspace_content_scopes for select to anon,authenticated using (true);
insert into public.workspace_content_scopes(id,kind,name,retired) values
 ('common','common','AI-Wise Common',false),('aws1','bachelor','Psychology',false),
 ('ped','bachelor','Pedagogical Sciences',false),('other','bachelor','Other courses',true);

-- A scope is valid when it is registered; the fixed id lists are no longer needed.
alter table public.workspace_content_sources
 drop constraint workspace_content_sources_course_check,
 drop constraint workspace_content_sources_chapter_check,
 add constraint workspace_content_sources_chapter_check
  check ((course='common' and chapter in ('c1','c2','c3','map')) or (course<>'common' and chapter in ('c2','c3'))),
 add constraint workspace_content_sources_scope foreign key(course) references public.workspace_content_scopes(id) on update cascade;
alter table public.workspace_beta_memos
 drop constraint beta_memo_studio_address,
 add constraint beta_memo_studio_address check (
 (content_course is null and content_chapter is null and content_locale is null and item_key is null) or
 (content_course is not null and content_chapter is not null and content_locale is not null and item_key is not null
 and content_course ~ '^[a-z][a-z0-9-]{0,39}$' and content_chapter in ('c1','c2','c3','map')
 and content_locale in ('en','nl') and length(item_key) between 1 and 160 and item_key like content_chapter||'.%')
 ),
 drop constraint workspace_beta_memos_page_check,
 add constraint workspace_beta_memos_page_check
  check (length(page)<=512 and page ~ '^(common/[a-z0-9-]+\.html|course-specific/[a-z0-9_-]+/[a-zA-Z0-9_.()-]+\.html)(\?course=[a-z][a-z0-9-]{0,39}(\.[a-z][a-z0-9-]{0,39})?(&lang=nl)?|\?lang=nl)?$');

-- Renaming a scope must reach every row that names it, so the references follow updates.
do $$
declare c record;
begin
 for c in select conrelid::regclass as tbl,conname,pg_get_constraintdef(oid) as def from pg_constraint
  where contype='f' and confrelid='public.workspace_content_sources'::regclass and confupdtype<>'c' loop
  execute format('alter table %s drop constraint %I',c.tbl,c.conname);
  execute format('alter table %s add constraint %I %s on update cascade',c.tbl,c.conname,c.def);
 end loop;
end $$;
update public.workspace_content_scopes set id='psychology' where id='aws1';
update public.workspace_content_scopes set id='pedagogical-sciences' where id='ped';

-- Tables without a reference: the working review checks follow the rename; retired checks are dropped.
delete from aiwise_private.beta_draft_checks where course='other';
update aiwise_private.beta_draft_checks set course='psychology' where course='aws1';
update aiwise_private.beta_draft_checks set course='pedagogical-sciences' where course='ped';
-- Comments stay attached to the page they were written on, now addressed as <bachelor>.<course>.
update public.workspace_beta_memos set page=regexp_replace(page,'\?course=(aws1|other)(&|$)','?course=psychology.aws1\2')
 where page ~ '\?course=(aws1|other)(&|$)';
update public.workspace_beta_memos set page=regexp_replace(page,'\?course=ped(&|$)','?course=pedagogical-sciences.inleiding\1')
 where page ~ '\?course=ped(&|$)';

-- A retired scope keeps its history but takes no new submissions or approvals.
create function aiwise_private.require_active_scope() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.workspace_content_scopes where id=new.course and retired) then
  raise exception 'This content area is retired.' using errcode='22023';
 end if;
 return new;
end $$;
revoke all on function aiwise_private.require_active_scope() from public,anon,authenticated;
create trigger workspace_submission_scope before insert on public.workspace_submissions
 for each row execute function aiwise_private.require_active_scope();
create trigger workspace_beta_scope before insert or update on public.workspace_beta_content
 for each row execute function aiwise_private.require_active_scope();
create or replace function aiwise_private.approved_beta_copy() returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('course',s.course,'chapter',s.chapter,'locale',s.locale,'slots',coalesce(b.slots,s.slots),'submission_id',b.submission_id) order by s.course,s.chapter,s.locale),'[]')
 from public.workspace_content_sources s
 join public.workspace_content_scopes c on c.id=s.course and not c.retired
 left join public.workspace_beta_content b on b.course=s.course and b.chapter=s.chapter and b.locale=s.locale
 where s.locale='en' or b.submission_id is not null;
$$;

-- Versions frozen before the rename are read under today's ids when a newer cycle is compared with them.
create function aiwise_private.content_scope_alias(p_id text) returns text language sql immutable set search_path='' as $$
 select case p_id when 'aws1' then 'psychology' when 'ped' then 'pedagogical-sciences' when 'other' then null else p_id end;
$$;
revoke all on function aiwise_private.content_scope_alias(text) from public,anon,authenticated;
create or replace function aiwise_private.beta_review_context(p_version uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare current_copy jsonb; previous_copy jsonb; selected public.workspace_beta_versions; previous public.workspace_beta_versions; changes jsonb; checks jsonb; open_count integer;
begin
 if auth.uid() is null or public.workspace_role() is null then raise exception 'Active team access required.' using errcode='42501';end if;
 if p_version is not null then
  select * into selected from public.workspace_beta_versions where id=p_version;
  if not found then raise exception 'Review version unavailable.' using errcode='22023';end if;
  current_copy:=selected.content;
  select * into previous from aiwise_private.beta_comparison_base(selected.number);
 else
  current_copy:=aiwise_private.approved_beta_copy();
  select * into previous from aiwise_private.beta_comparison_base(null);
 end if;
 previous_copy:=coalesce(previous.content,'[]'::jsonb);
 -- Two earlier versions are compared as they were saved. Only a copy that already uses today's ids
 -- has its comparison version translated; the retired "other" copy is left out of that comparison.
 if not exists(select 1 from jsonb_array_elements(current_copy) v where aiwise_private.content_scope_alias(v->>'course') is distinct from v->>'course') then
  select coalesce(jsonb_agg(jsonb_set(v,'{course}',to_jsonb(aiwise_private.content_scope_alias(v->>'course'))) order by ord),'[]') into previous_copy
  from jsonb_array_elements(previous_copy) with ordinality t(v,ord) where aiwise_private.content_scope_alias(v->>'course') is not null;
 end if;
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
 if p_version is not null then
  select coalesce(jsonb_agg(to_jsonb(c)),'[]') into checks from public.workspace_beta_checks c where version_id=p_version;
 else
  select coalesce(jsonb_agg(to_jsonb(c)),'[]') into checks from aiwise_private.beta_draft_checks c
  join jsonb_array_elements(changes) d on c.course=d->>'course' and c.chapter=d->>'chapter' and c.locale=d->>'locale' and c.item_key=d->>'key'
  where c.content_hash=md5(coalesce(previous.id::text,'')||d::text);
 end if;
 select count(*) into open_count from public.workspace_beta_memos where version_id is not distinct from p_version and not resolved;
 return jsonb_build_object('version_id',p_version,'previous_id',previous.id,'current_content',current_copy,'fingerprint',md5(current_copy::text||coalesce(previous.id::text,'')),'previous_number',previous.number,'previous_kind',case when previous.id is null then null when previous.published_at is null then 'snapshot' else 'published' end,'previous_title',previous.title,'changes',changes,'checks',checks,'open_memos',open_count);
end $$;
notify pgrst,'reload schema';
commit;
