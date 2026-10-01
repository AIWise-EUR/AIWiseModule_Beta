-- Publish closes the accumulated approved Beta copy; preparation does not allocate a version.
begin;
alter table public.workspace_beta_versions add column published_at timestamptz;
-- Preserve existing snapshots and numbers. Previously approved releases retain their identity.
update public.workspace_beta_versions v set published_at=r.approved_at from (select version_id,min(approved_at) approved_at from public.workspace_releases where approved_at is not null group by version_id) r where r.version_id=v.id;
alter table public.workspace_releases alter column version_id drop not null,alter column version_number drop not null,
 add column candidate_content jsonb,add column candidate_fingerprint text;
grant select(candidate_fingerprint) on public.workspace_releases to authenticated;
create table aiwise_private.beta_draft_checks (
 course text not null,chapter text not null,locale text not null,item_key text not null,content_hash text not null,
 reviewed boolean not null,reviewer_id uuid not null references auth.users(id),reviewer_name text not null,updated_at timestamptz not null default clock_timestamp(),
 primary key(course,chapter,locale,item_key)
);
create index beta_draft_checks_reviewer on aiwise_private.beta_draft_checks(reviewer_id);
create index workspace_beta_versions_published on public.workspace_beta_versions(number desc) where published_at is not null;
alter table aiwise_private.beta_draft_checks enable row level security;
revoke all on aiwise_private.beta_draft_checks from public,anon,authenticated;
-- The same transaction lock defines the boundary between two publication cycles.
create function aiwise_private.lock_beta_cycle() returns trigger language plpgsql security definer set search_path='' as $$
begin perform pg_advisory_xact_lock(hashtextextended('beta-publish-cycle',0));return null;end $$;
create trigger beta_cycle_content before insert or update or delete on public.workspace_beta_content for each statement execute function aiwise_private.lock_beta_cycle();
create trigger beta_cycle_sources before insert or update or delete on public.workspace_content_sources for each statement execute function aiwise_private.lock_beta_cycle();
create function aiwise_private.approved_beta_copy() returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('course',s.course,'chapter',s.chapter,'locale',s.locale,'slots',coalesce(b.slots,s.slots),'submission_id',b.submission_id) order by s.course,s.chapter,s.locale),'[]')
 from public.workspace_content_sources s left join public.workspace_beta_content b using(course,chapter,locale) where s.locale='en' or b.submission_id is not null;
$$;
create or replace function aiwise_private.create_beta_version(p_id uuid,p_title text,p_summary text) returns uuid language plpgsql security definer set search_path='' as $$
begin raise exception 'Versions are created by Publish. Review the next release in Beta.' using errcode='22023';end $$;
create or replace function aiwise_private.beta_review_context(p_version uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare current_copy jsonb; previous_copy jsonb; selected public.workspace_beta_versions; previous public.workspace_beta_versions; changes jsonb; checks jsonb; open_count integer;
begin
 if auth.uid() is null or public.workspace_role() is null then raise exception 'Active team access required.' using errcode='42501';end if;
 if p_version is not null then
  select * into selected from public.workspace_beta_versions where id=p_version;
  if not found then raise exception 'Review version unavailable.' using errcode='22023';end if;
  current_copy:=selected.content;
  select * into previous from public.workspace_beta_versions where number<selected.number and (selected.published_at is null or published_at is not null) order by number desc limit 1;
 else
  current_copy:=aiwise_private.approved_beta_copy();
  select * into previous from public.workspace_beta_versions where published_at is not null order by number desc limit 1;
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
 if p_version is not null then
  select coalesce(jsonb_agg(to_jsonb(c)),'[]') into checks from public.workspace_beta_checks c where version_id=p_version;
 else
  select coalesce(jsonb_agg(to_jsonb(c)),'[]') into checks from aiwise_private.beta_draft_checks c
  join jsonb_array_elements(changes) d on c.course=d->>'course' and c.chapter=d->>'chapter' and c.locale=d->>'locale' and c.item_key=d->>'key'
  where c.content_hash=md5(coalesce(previous.id::text,'')||d::text);
 end if;
 select count(*) into open_count from public.workspace_beta_memos where version_id is not distinct from p_version and not resolved;
 return jsonb_build_object('version_id',p_version,'previous_id',previous.id,'current_content',current_copy,'fingerprint',md5(current_copy::text||coalesce(previous.id::text,'')),'previous_number',previous.number,'previous_title',previous.title,'changes',changes,'checks',checks,'open_memos',open_count);
end $$;

-- Draft checks reject stale pages and survive approvals only if this item's comparison is unchanged.
create function aiwise_private.check_beta_draft_item(p_course text,p_chapter text,p_locale text,p_key text,p_reviewed boolean,p_expected timestamptz,p_fingerprint text) returns void
language plpgsql security definer set search_path='' as $$
declare ctx jsonb; item jsonb; old aiwise_private.beta_draft_checks; display text; hash text;
begin
 if auth.uid() is null or public.workspace_role() is null then raise exception 'Active team access required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('beta-publish-cycle',0));
 ctx:=aiwise_private.beta_review_context(null);
 if p_fingerprint is distinct from ctx->>'fingerprint' then raise exception 'Approved content changed. Refresh before reviewing.' using errcode='40001';end if;
 select d into item from jsonb_array_elements(ctx->'changes') d where d->>'course'=p_course and d->>'chapter'=p_chapter and d->>'locale'=p_locale and d->>'key'=p_key;
 if item is null or p_reviewed is null then raise exception 'Item is not in this checklist' using errcode='22023';end if;
 hash:=md5(coalesce(ctx->>'previous_id','')||item::text);
 select * into old from aiwise_private.beta_draft_checks where course=p_course and chapter=p_chapter and locale=p_locale and item_key=p_key and content_hash=hash;
 if old.updated_at is distinct from p_expected then raise exception 'Review status changed. Refresh and retry.' using errcode='40001';end if;
 select left(coalesce(nullif(btrim(raw_user_meta_data->>'display_name'),''),'Team member'),80) into display from auth.users where id=auth.uid();
 insert into aiwise_private.beta_draft_checks values(p_course,p_chapter,p_locale,p_key,hash,p_reviewed,auth.uid(),display,clock_timestamp())
 on conflict(course,chapter,locale,item_key) do update set content_hash=excluded.content_hash,reviewed=excluded.reviewed,reviewer_id=excluded.reviewer_id,reviewer_name=excluded.reviewer_name,updated_at=excluded.updated_at;
end $$;
create function public.workspace_check_beta_draft_item(p_course text,p_chapter text,p_locale text,p_key text,p_reviewed boolean,p_expected timestamptz,p_fingerprint text) returns void
language sql security invoker set search_path='' as $$select aiwise_private.check_beta_draft_item(p_course,p_chapter,p_locale,p_key,p_reviewed,p_expected,p_fingerprint);$$;

-- Keep comments with the cycle they reviewed, including replies and mention identities.
alter table public.workspace_beta_memos add column draft_base_version uuid references public.workspace_beta_versions(id);
create index workspace_beta_memos_draft_base on public.workspace_beta_memos(draft_base_version);
grant insert(draft_base_version) on public.workspace_beta_memos to authenticated;
drop trigger beta_memo_stamp on public.workspace_beta_memos;
create trigger beta_memo_stamp before insert or update of resolved on public.workspace_beta_memos for each row execute function aiwise_private.beta_feedback_stamp();
create function aiwise_private.check_beta_memo_cycle() returns trigger language plpgsql security definer set search_path='' as $$
declare baseline uuid;
begin
 if new.version_id is null then
  perform pg_advisory_xact_lock(hashtextextended('beta-publish-cycle',0));
  select id into baseline from public.workspace_beta_versions where published_at is not null order by number desc limit 1;
  if new.draft_base_version is distinct from baseline then raise exception 'This Beta cycle was published. Reopen Beta before posting.' using errcode='40001';end if;
 end if;return new;
end $$;
create trigger beta_memo_cycle before insert on public.workspace_beta_memos for each row execute function aiwise_private.check_beta_memo_cycle();

-- Worker-only snapshot and storage endpoints; no prepared candidate has a version number.
create function public.workspace_release_candidate() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('content',c,'fingerprint',md5(c::text||coalesce((select id::text from public.workspace_beta_versions where published_at is not null order by number desc limit 1),''))) from (select aiwise_private.approved_beta_copy() c) s;
$$;
create function public.workspace_store_release_candidate(p_id uuid,p_author uuid,p_source text,p_target text,p_files jsonb,p_content jsonb,p_fingerprint text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare old public.workspace_releases; latest jsonb; k text; val jsonb; manifest jsonb;
begin
 if not exists(select 1 from public.workspace_members where user_id=p_author and active and role='admin') then raise exception 'Administrator required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('beta-publish-cycle',0));
 select * into old from public.workspace_releases where id=p_id;
 if found then
  if old.author_id<>p_author or old.candidate_fingerprint is distinct from p_fingerprint then raise exception 'Release identity changed';end if;return p_id;
 end if;
 latest:=public.workspace_release_candidate();
 if p_fingerprint is distinct from latest->>'fingerprint' or p_content is distinct from latest->'content' then raise exception 'approved_content_changed' using errcode='40001';end if;
 if p_files is null or jsonb_typeof(p_files)<>'object' or octet_length(p_files::text)>4000000 then raise exception 'Invalid release files';end if;
 for k,val in select * from jsonb_each(p_files) loop
  if k not in ('aiwise-c1-final.html','aiwise-c2-final.html','aiwise-c3-final.html','aiwise-c1-anatomy-2d.html','published-content.json','published-content.js','published-common-content.js','published-course-loader.js','published-content-language.js','published-ui-effects.js','published-feedback-widget.js') or jsonb_typeof(val)<>'string' then raise exception 'Unsupported release file';end if;
 end loop;
 if (select count(*) from jsonb_object_keys(p_files))<>11 then raise exception 'Incomplete release';end if;
 manifest:=(p_files->>'published-content.json')::jsonb;
 if manifest->>'release_id' is distinct from p_id::text or manifest->>'version_id' is distinct from p_id::text or manifest->>'version_number' is not null or manifest->>'source_sha' is distinct from p_source or manifest->>'target_sha' is distinct from p_target or manifest->'content' is distinct from p_content then raise exception 'Invalid candidate manifest';end if;
 insert into public.workspace_releases(id,version_title,author_id,source_sha,target_sha,files,candidate_content,candidate_fingerprint) values(p_id,'Next release',p_author,p_source,p_target,p_files,p_content,p_fingerprint);return p_id;
end $$;
-- The retired preparation endpoint must not allow an older worker to publish a disconnected snapshot.
revoke execute on function public.workspace_store_release(uuid,uuid,uuid,text,text,jsonb) from service_role;
create or replace function aiwise_private.approve_release(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.workspace_releases; v public.workspace_beta_versions; ctx jsonb; manifest jsonb; display text; stamp timestamptz:=clock_timestamp();
begin
 if auth.uid() is null or public.workspace_role() is distinct from 'admin' then raise exception 'Administrator required' using errcode='42501';end if;
 if not (select enabled from aiwise_private.release_settings where singleton) then raise exception 'Publishing is not enabled';end if;
 perform pg_advisory_xact_lock(hashtextextended('beta-publish-cycle',0));
 select * into r from public.workspace_releases where id=p_id for update;
 if not found then raise exception 'Release not found';end if;
 if r.status in ('queued','processing','committed') then return;end if;
 if r.status<>'prepared' then raise exception 'Prepare a new release or retry the failed commit';end if;
 if r.candidate_content is null then raise exception 'Prepare the accumulated Beta content again.' using errcode='22023';end if;
 if exists(select 1 from public.workspace_releases where id<>p_id and status in ('queued','processing')) then raise exception 'A release is still publishing.' using errcode='55000';end if;
 ctx:=aiwise_private.beta_review_context(null);
 if r.candidate_fingerprint is distinct from ctx->>'fingerprint' or r.candidate_content is distinct from ctx->'current_content' then raise exception 'Approved content changed. Prepare the release again.' using errcode='40001';end if;
 perform pg_advisory_xact_lock(hashtextextended('beta-version-sequence',0));
 select left(coalesce(nullif(btrim(raw_user_meta_data->>'display_name'),''),'Team member'),80) into display from auth.users where id=auth.uid();
 stamp:=clock_timestamp();
 insert into public.workspace_beta_versions(id,title,summary,author_id,author_name,content,created_at,published_at)
 values(p_id,to_char(stamp at time zone 'UTC','YYYY-MM-DD'),'Published from accumulated approved Beta content.',auth.uid(),display,r.candidate_content,stamp,stamp) returning * into v;
 insert into public.workspace_beta_checks(version_id,course,chapter,locale,item_key,reviewed,reviewer_id,reviewer_name,updated_at)
 select v.id,c.course,c.chapter,c.locale,c.item_key,c.reviewed,c.reviewer_id,c.reviewer_name,c.updated_at
 from jsonb_populate_recordset(null::aiwise_private.beta_draft_checks,ctx->'checks') c;
 update public.workspace_beta_memos set version_id=v.id where version_id is null;
 delete from aiwise_private.beta_draft_checks;
 manifest:=(r.files->>'published-content.json')::jsonb;
 manifest:=manifest||jsonb_build_object('version_number',v.number,'version_created_at',stamp);
 update public.workspace_releases set version_id=v.id,version_number=v.number,version_title=v.title,
 files=jsonb_set(files,'{published-content.json}',to_jsonb(manifest::text||E'\n')),status='queued',approved_by=auth.uid(),approved_at=stamp,updated_at=stamp where id=p_id;
end $$;
revoke all on function aiwise_private.lock_beta_cycle(),aiwise_private.approved_beta_copy(),aiwise_private.check_beta_memo_cycle(),aiwise_private.check_beta_draft_item(text,text,text,text,boolean,timestamptz,text),public.workspace_check_beta_draft_item(text,text,text,text,boolean,timestamptz,text),public.workspace_release_candidate(),public.workspace_store_release_candidate(uuid,uuid,text,text,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function aiwise_private.check_beta_draft_item(text,text,text,text,boolean,timestamptz,text),public.workspace_check_beta_draft_item(text,text,text,text,boolean,timestamptz,text) to authenticated;
grant execute on function aiwise_private.approved_beta_copy(),public.workspace_release_candidate(),public.workspace_store_release_candidate(uuid,uuid,text,text,jsonb,jsonb,text) to service_role;
grant select on public.workspace_content_sources,public.workspace_beta_content to service_role;
notify pgrst,'reload schema';
commit;
