-- Shared layout approvals. Installation never rewrites authored content.
begin;
alter table public.workspace_submissions add column if not exists layout_plan jsonb;
alter table public.workspace_beta_content add column if not exists structure_only boolean not null default false;
alter table public.workspace_beta_content add column if not exists layout_review_required boolean not null default false;

create or replace function aiwise_private.layout_text(source jsonb,target jsonb,field text default '')
returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb; k text; v jsonb; i integer;
begin
 if jsonb_typeof(source)='string' then
  if field in ('actor','tag') then return source; end if;
  return case when jsonb_typeof(target)='string' then target else '""'::jsonb end;
 elsif jsonb_typeof(source)='array' then
  result='[]';i=0;
  for v in select value from jsonb_array_elements(source) loop
   result=result||jsonb_build_array(aiwise_private.layout_text(v,target->i));i=i+1;
  end loop;return result;
 elsif jsonb_typeof(source)='object' then
  result='{}';for k,v in select * from jsonb_each(source) loop
   result=result||jsonb_build_object(k,aiwise_private.layout_text(v,target->k,k));
  end loop;return result;
 end if;
 return source;
end; $$;

create or replace function aiwise_private.layout_project(base jsonb,next_copy jsonb,peer jsonb,maps jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb:=peer; k text; v jsonb; old_array jsonb; new_array jsonb; peer_array jsonb; mapping jsonb;
 a jsonb; old_index jsonb; i integer; j integer; b jsonb; own_box jsonb; fields jsonb; boxes jsonb:='[]';
 formats jsonb:='[]'; f jsonb; p jsonb; offset_index integer; txt jsonb; joined text; path text[];
begin
 if jsonb_typeof(maps) is distinct from 'object' or exists(select 1 from jsonb_object_keys(maps) x where x not in ('c2.examples','c2.sat_example')) then raise exception 'Invalid layout mapping.'; end if;
 for k,v in select * from jsonb_each(next_copy) where key<>'_studio' loop
  result=result||jsonb_build_object(k,aiwise_private.layout_text(v,peer->k));
 end loop;
 foreach k in array array['c2.examples','c2.sat_example'] loop
  old_array=case when k='c2.examples' then base->k else base->k->'phases' end;
  new_array=case when k='c2.examples' then next_copy->k else next_copy->k->'phases' end;
  peer_array=case when k='c2.examples' then peer->k else peer->k->'phases' end;
  if old_array is null and new_array is null then continue; end if;
  mapping=maps->k;
  if jsonb_typeof(old_array) is distinct from 'array' or jsonb_typeof(new_array) is distinct from 'array' or jsonb_typeof(peer_array) is distinct from 'array' or
   jsonb_typeof(mapping) is distinct from 'array' or jsonb_array_length(old_array)<>jsonb_array_length(peer_array) or jsonb_array_length(mapping)<>jsonb_array_length(new_array)
   then raise exception 'The two languages have different item structures. Review their item order before synchronizing; existing text is preserved.'; end if;
  a='[]';i=0;
  for v in select value from jsonb_array_elements(new_array) loop
   old_index=mapping->i;
   if old_index<>'null'::jsonb and (jsonb_typeof(old_index)<>'number' or old_index::text !~ '^[0-9]+$' or old_index::numeric>=jsonb_array_length(old_array)) then raise exception 'Invalid layout mapping.'; end if;
   a=a||jsonb_build_array(aiwise_private.layout_text(v,case when old_index='null'::jsonb then null else peer_array->(old_index::text::integer) end));i=i+1;
  end loop;
  result=case when k='c2.examples' then jsonb_set(result,array[k],a) else jsonb_set(result,array[k,'phases'],a) end;
 end loop;
 for f in select value from jsonb_array_elements(coalesce(peer#>'{_studio,formats}','[]')) loop
  k=f->>'slot';offset_index=case when k='c2.examples' then 0 when k='c2.sat_example' and f#>>'{path,0}'='phases' then 1 else -1 end;
  if offset_index<0 then a=jsonb_build_array(f);
  else
   a='[]';i=0;for old_index in select value from jsonb_array_elements(coalesce(maps->k,'[]')) loop
    if old_index<>'null'::jsonb and old_index::text=f->'path'->>offset_index then
     p=jsonb_set(f,array['path',offset_index::text],to_jsonb(i::text));a=a||jsonb_build_array(p);
    end if;i=i+1;
   end loop;
  end if;
  for p in select value from jsonb_array_elements(a) loop
   select coalesce(array_agg(value),'{}') into path from jsonb_array_elements_text(p->'path');
   txt=(result->(p->>'slot'))#>path;
   select coalesce(string_agg(value->>'text','' order by ord),'') into joined from jsonb_array_elements(p->'runs') with ordinality t(value,ord);
   if jsonb_typeof(txt)='string' and txt#>>'{}'=joined then formats=formats||jsonb_build_array(p);end if;
  end loop;
 end loop;
 for b in select value from jsonb_array_elements(coalesce(next_copy#>'{_studio,boxes}','[]')) loop
  select value into own_box from jsonb_array_elements(coalesce(peer#>'{_studio,boxes}','[]')) where value->>'id'=b->>'id';
  if own_box is not null and (own_box->>'template'<>b->>'template' or jsonb_array_length(own_box->'fields')<>jsonb_array_length(b->'fields')) then raise exception 'A translated box has an incompatible template. Review it before synchronizing.'; end if;
  if own_box is not null then fields=own_box->'fields';else
   select coalesce(jsonb_agg('[{"text":""}]'::jsonb),'[]') into fields from jsonb_array_elements(b->'fields');
  end if;
  boxes=boxes||jsonb_build_array(jsonb_set(b,'{fields}',fields));
 end loop;
 if next_copy ? '_studio' or peer ? '_studio' then result=result||jsonb_build_object('_studio',jsonb_build_object('version',1,'formats',formats,'boxes',boxes));end if;
 if not public.workspace_valid_content(result,peer) then raise exception 'Synchronized layout is not compatible with the other language. Existing content is preserved.';end if;
 return result;
end; $$;

create or replace function aiwise_private.layout_context(p_id uuid,p_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.workspace_submissions; context jsonb; peer jsonb; peer_release uuid; other_locale text;
begin
 context=aiwise_private.prepare_content_approval(p_id,p_revision);
 select * into r from public.workspace_submissions where id=p_id;
 if exists(select 1 from public.workspace_beta_content where course=r.course and chapter=r.chapter and locale=r.locale and (structure_only or layout_review_required)) then context=context||jsonb_build_object('language_review_required',true);end if;
 if r.layout_plan is null then return context;end if;
 other_locale=case when r.locale='en' then 'nl' else 'en' end;
 select coalesce(b.slots,s.slots),b.submission_id into peer,peer_release from public.workspace_content_sources s left join public.workspace_beta_content b using(course,chapter,locale)
 where s.course=r.course and s.chapter=r.chapter and s.locale=other_locale;
 if peer is distinct from r.layout_plan->'peer_base' or peer_release is distinct from nullif(r.layout_plan->>'peer_release','')::uuid or context->'latest' is distinct from context->'base'
 then raise exception 'One language changed after this layout draft was prepared. Reopen Studio and review the saved draft before submitting a new request. Both translations are preserved.'; end if;
 perform aiwise_private.layout_project(context->'base',context->'draft',peer,r.layout_plan->'maps');
 return context||jsonb_build_object('layout',r.layout_plan||jsonb_build_object('locale',other_locale));
end; $$;

create or replace function aiwise_private.submit_layout_content(p_client_id uuid,p_course text,p_chapter text,p_slots jsonb,p_base_slots jsonb,p_base_release uuid,p_saved_at timestamptz,p_summary text,p_locale text,p_source_release uuid,p_layout jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; existing public.workspace_submissions; peer jsonb; peer_release uuid;
begin
 if public.workspace_role() is distinct from 'admin' then raise exception 'Administrator permission is required.' using errcode='42501';end if;
 if jsonb_typeof(p_layout) is distinct from 'object' or p_layout->'version' is distinct from '1'::jsonb or
  exists(select 1 from jsonb_object_keys(p_layout) k where k not in ('version','peer_base','peer_release','maps')) or octet_length(p_layout::text)>2500000 then raise exception 'Invalid layout request.';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_client_id::text,0));
 select * into existing from public.workspace_submissions where author_id=auth.uid() and client_id=p_client_id;
 if found then
  if existing.layout_plan is distinct from p_layout or existing.slots is distinct from p_slots or existing.base_slots is distinct from p_base_slots or existing.locale is distinct from p_locale or existing.course is distinct from p_course or existing.chapter is distinct from p_chapter or existing.source_release is distinct from p_source_release then raise exception 'Submission ID already belongs to another content copy.';end if;return existing.id;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('aiwise-beta:'||p_course||':'||p_chapter||':en',0));
 perform pg_advisory_xact_lock(hashtextextended('aiwise-beta:'||p_course||':'||p_chapter||':nl',0));
 select coalesce(b.slots,s.slots),b.submission_id into peer,peer_release from public.workspace_content_sources s left join public.workspace_beta_content b using(course,chapter,locale)
 where s.course=p_course and s.chapter=p_chapter and s.locale=case when p_locale='en' then 'nl' else 'en' end;
 if peer is null or peer is distinct from p_layout->'peer_base' or peer_release is distinct from nullif(p_layout->>'peer_release','')::uuid then raise exception 'The other language changed. Reload Studio before submitting this layout. Your saved draft is preserved.';end if;
 perform aiwise_private.layout_project(p_base_slots,p_slots,peer,p_layout->'maps');
 result=aiwise_private.submit_localized_content(p_client_id,p_course,p_chapter,p_slots,p_base_slots,p_base_release,p_saved_at,p_summary,p_locale,p_source_release);
 update public.workspace_submissions set layout_plan=p_layout where id=result;
 return result;
end; $$;

-- Retain the tested single-language implementation, callable only by guarded wrappers.
do $$begin
 if to_regprocedure('aiwise_private.apply_content_approval_single(uuid,integer,uuid,jsonb,jsonb,jsonb,text)') is null then
  alter function aiwise_private.apply_content_approval(uuid,integer,uuid,jsonb,jsonb,jsonb,text) rename to apply_content_approval_single;
 end if;
 if to_regprocedure('aiwise_private.decide_localized_content_single(uuid,integer,text,text)') is null then
  alter function aiwise_private.decide_localized_content(uuid,integer,text,text) rename to decide_localized_content_single;
 end if;
end; $$;
revoke all on function aiwise_private.apply_content_approval_single(uuid,integer,uuid,jsonb,jsonb,jsonb,text),aiwise_private.decide_localized_content_single(uuid,integer,text,text) from public,anon,authenticated;
-- Reviewing an otherwise unchanged structure-only copy still establishes a real
-- authored approval and emits its own archive, rather than leaving it provisional.
do $$
declare definition text;
begin
 definition=pg_get_functiondef('aiwise_private.apply_content_approval_single(uuid,integer,uuid,jsonb,jsonb,jsonb,text)'::regprocedure);
 if position('layout_review_required' in definition)=0 then
  if position('if not unchanged then' in definition)=0 then raise exception 'Unexpected approval implementation; review migration before proceeding.';end if;
  definition=replace(definition,'if not unchanged then','if exists(select 1 from public.workspace_beta_content where course=r.course and chapter=r.chapter and locale=r.locale and (structure_only or layout_review_required)) then unchanged=false;end if; if not unchanged then');
  execute definition;
 end if;
end; $$;

create or replace function aiwise_private.apply_content_approval(p_id uuid,p_revision integer,p_expected_release uuid,p_expected_slots jsonb,p_resolutions jsonb,p_result jsonb,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.workspace_submissions where id=p_id and layout_plan is not null) then raise exception 'Review both languages before approving this shared layout.';end if;
 return aiwise_private.apply_content_approval_single(p_id,p_revision,p_expected_release,p_expected_slots,p_resolutions,p_result,p_reason);
end; $$;
create or replace function aiwise_private.decide_localized_content(p_id uuid,p_revision integer,p_status text,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 if p_status='approved' and exists(select 1 from public.workspace_submissions where id=p_id and layout_plan is not null) then raise exception 'Review both languages before approving this shared layout.';end if;
 return aiwise_private.decide_localized_content_single(p_id,p_revision,p_status,p_reason);
end; $$;
create or replace function public.workspace_prepare_content_approval(p_id uuid,p_revision integer)
returns jsonb language sql security invoker set search_path='' as $$select aiwise_private.layout_context(p_id,p_revision);$$;

create or replace function aiwise_private.apply_layout_approval(p_id uuid,p_revision integer,p_expected_release uuid,p_expected_slots jsonb,p_resolutions jsonb,p_result jsonb,p_reason text,p_peer_result jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.workspace_submissions; context jsonb; projected jsonb; other_locale text; peer_id uuid:=gen_random_uuid(); reviewer text; peer_row public.workspace_beta_content;
begin
 if public.workspace_role() is distinct from 'admin' then raise exception 'Administrator permission is required.' using errcode='42501';end if;
 select * into r from public.workspace_submissions where id=p_id for update;
 if r.layout_plan is null then raise exception 'This request has no shared layout change.';end if;
 perform pg_advisory_xact_lock(hashtextextended('aiwise-beta:'||r.course||':'||r.chapter||':en',0));
 perform pg_advisory_xact_lock(hashtextextended('aiwise-beta:'||r.course||':'||r.chapter||':nl',0));
 context=aiwise_private.layout_context(p_id,p_revision);
 projected=aiwise_private.layout_project(context->'base',p_result,r.layout_plan->'peer_base',r.layout_plan->'maps');
 if projected is distinct from p_peer_result then raise exception 'The other-language preview changed. Reload and review again.';end if;
 perform aiwise_private.apply_content_approval_single(p_id,p_revision,p_expected_release,p_expected_slots,p_resolutions,p_result,p_reason);
 if projected is distinct from r.layout_plan->'peer_base' then
  other_locale=case when r.locale='en' then 'nl' else 'en' end;
  select * into peer_row from public.workspace_beta_content where course=r.course and chapter=r.chapter and locale=other_locale;
  select reviewer_name into reviewer from public.workspace_submissions where id=p_id;
  insert into public.workspace_submissions(id,client_id,course,chapter,author_id,author_name,summary,slots,base_slots,base_release,saved_at,locale,source_release,catalog_version,status,revision,reviewer_id,reviewer_name,decision_reason,decided_at,approval_result)
  values(peer_id,gen_random_uuid(),r.course,r.chapter,auth.uid(),reviewer,'Shared layout synchronized from '||p_id,projected,r.layout_plan->'peer_base',peer_row.submission_id,now(),other_locale,peer_row.source_release,2,'approved',2,auth.uid(),reviewer,p_reason,now(),
   jsonb_build_object('base_release',peer_row.submission_id,'base_slots',r.layout_plan->'peer_base','slots',projected,'resolutions','[]'::jsonb,'no_op',false,'layout_origin',p_id,'translation_required',true));
  insert into public.workspace_beta_content(course,chapter,locale,submission_id,slots,source_release,structure_only,layout_review_required)
  values(r.course,r.chapter,other_locale,peer_id,projected,peer_row.source_release,coalesce(peer_row.structure_only,true),true)
  on conflict(course,chapter,locale) do update set submission_id=excluded.submission_id,slots=excluded.slots,source_release=excluded.source_release,structure_only=excluded.structure_only,layout_review_required=true,approved_at=now();
  update public.workspace_submissions set approval_result=approval_result||jsonb_build_object('layout_counterpart',peer_id,'layout_before',r.layout_plan->'peer_base','layout_after',projected) where id=p_id;
 end if;
 return p_id;
end; $$;

create or replace function public.workspace_submit_layout_content(p_client_id uuid,p_course text,p_chapter text,p_slots jsonb,p_base_slots jsonb,p_base_release uuid,p_saved_at timestamptz,p_summary text,p_locale text,p_source_release uuid,p_layout jsonb)
returns uuid language sql security invoker set search_path='' as $$select aiwise_private.submit_layout_content(p_client_id,p_course,p_chapter,p_slots,p_base_slots,p_base_release,p_saved_at,p_summary,p_locale,p_source_release,p_layout);$$;
create or replace function public.workspace_apply_layout_approval(p_id uuid,p_revision integer,p_expected_release uuid,p_expected_slots jsonb,p_resolutions jsonb,p_result jsonb,p_reason text,p_peer_result jsonb)
returns uuid language sql security invoker set search_path='' as $$select aiwise_private.apply_layout_approval(p_id,p_revision,p_expected_release,p_expected_slots,p_resolutions,p_result,p_reason,p_peer_result);$$;
revoke all on function aiwise_private.submit_layout_content(uuid,text,text,jsonb,jsonb,uuid,timestamptz,text,text,uuid,jsonb),aiwise_private.apply_layout_approval(uuid,integer,uuid,jsonb,jsonb,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function aiwise_private.submit_layout_content(uuid,text,text,jsonb,jsonb,uuid,timestamptz,text,text,uuid,jsonb),aiwise_private.apply_layout_approval(uuid,integer,uuid,jsonb,jsonb,jsonb,text,jsonb) to authenticated;

-- A human content approval clears structure-only status. Layout-only copies never
-- masquerade as completed Dutch translations in a freshly prepared release.
create or replace function aiwise_private.mark_content_language_reviewed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.workspace_submissions where id=new.submission_id and approval_result ? 'layout_origin') then
  new.structure_only=false;new.layout_review_required=false;
 end if;
 return new;
end; $$;
drop trigger if exists workspace_language_reviewed on public.workspace_beta_content;
create trigger workspace_language_reviewed before insert or update on public.workspace_beta_content for each row execute function aiwise_private.mark_content_language_reviewed();

create or replace function aiwise_private.approved_beta_copy() returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('course',s.course,'chapter',s.chapter,'locale',s.locale,'slots',coalesce(b.slots,s.slots),'submission_id',b.submission_id) order by s.course,s.chapter,s.locale),'[]')
 from public.workspace_content_sources s join public.workspace_content_scopes c on c.id=s.course and not c.retired
 left join public.workspace_beta_content b using(course,chapter,locale)
 where s.locale='en' or (b.submission_id is not null and not b.structure_only);
$$;
create or replace function aiwise_private.queue_github_content() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' and new.submission_id=old.submission_id then return new;end if;
 insert into public.workspace_github_jobs(submission_id,course,chapter,locale,payload)
 values(new.submission_id,new.course,new.chapter,new.locale,jsonb_build_object('schema',1,'course',new.course,'chapter',new.chapter,'locale',new.locale,'submission_id',new.submission_id,'source_release',new.source_release,'approved_at',new.approved_at,'slots',new.slots,'structure_only',new.structure_only,'layout_review_required',new.layout_review_required))
 on conflict(submission_id) do nothing;
 return new;
end; $$;
create or replace function public.workspace_studio_capabilities() returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object(
  'example_boxes',1,
  'bidirectional_layout',1,
  'blocks',case when exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='aiwise_private' and p.proname='valid_studio_extension' and p.pronargs=2) then 1 else 0 end,
  'sat_phases',case when exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='aiwise_private' and p.proname='valid_sat_example' and p.pronargs=1) then 1 else 0 end,
  'approval_merge',case when
   exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='workspace_prepare_content_approval' and p.pronargs=2)
   and exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='workspace_apply_content_approval' and p.pronargs=7)
   and exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='aiwise_private' and p.proname='approval_merge' and p.pronargs=4)
   then 1 else 0 end
 );
$$;
revoke all on function aiwise_private.layout_text(jsonb,jsonb,text),aiwise_private.layout_project(jsonb,jsonb,jsonb,jsonb),aiwise_private.layout_context(uuid,integer),aiwise_private.mark_content_language_reviewed() from public,anon,authenticated;
revoke all on function aiwise_private.apply_content_approval(uuid,integer,uuid,jsonb,jsonb,jsonb,text),aiwise_private.decide_localized_content(uuid,integer,text,text) from public,anon;
grant execute on function aiwise_private.layout_context(uuid,integer),aiwise_private.apply_content_approval(uuid,integer,uuid,jsonb,jsonb,jsonb,text),aiwise_private.decide_localized_content(uuid,integer,text,text) to authenticated;
revoke all on function public.workspace_submit_layout_content(uuid,text,text,jsonb,jsonb,uuid,timestamptz,text,text,uuid,jsonb),public.workspace_apply_layout_approval(uuid,integer,uuid,jsonb,jsonb,jsonb,text,jsonb) from public,anon;
grant execute on function public.workspace_submit_layout_content(uuid,text,text,jsonb,jsonb,uuid,timestamptz,text,text,uuid,jsonb),public.workspace_apply_layout_approval(uuid,integer,uuid,jsonb,jsonb,jsonb,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
