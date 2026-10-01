-- Preserve the pre-Publish review baseline without marking snapshots as published.
begin;
create function aiwise_private.beta_comparison_base(p_before bigint) returns public.workspace_beta_versions
language sql stable security invoker set search_path='' as $$
 select v from public.workspace_beta_versions v
 where p_before is null or v.number<p_before
 order by (v.published_at is not null) desc,v.number desc limit 1;
$$;
revoke all on function aiwise_private.beta_comparison_base(bigint) from public,anon,authenticated;
grant execute on function aiwise_private.beta_comparison_base(bigint) to service_role;
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
create or replace function aiwise_private.check_beta_memo_cycle() returns trigger language plpgsql security definer set search_path='' as $$
declare baseline uuid;
begin
 if new.version_id is null then
  perform pg_advisory_xact_lock(hashtextextended('beta-publish-cycle',0));
  select id into baseline from aiwise_private.beta_comparison_base(null);
  if new.draft_base_version is distinct from baseline then raise exception 'This Beta cycle was published. Reopen Beta before posting.' using errcode='40001';end if;
 end if;return new;
end $$;
create or replace function public.workspace_release_candidate() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('content',c,'fingerprint',md5(c::text||coalesce((select id::text from aiwise_private.beta_comparison_base(null)),''))) from (select aiwise_private.approved_beta_copy() c) s;
$$;
-- Existing guarded entry points keep their privileges; only the private selector is new.
notify pgrst,'reload schema';
commit;
