-- Review immutable submissions against current Beta, at field/added-box granularity.
begin;
alter table public.workspace_submissions add column if not exists approval_result jsonb;

-- Missing entries are SQL NULL; JSON null remains a present value inside its wrapper.
create or replace function aiwise_private.approval_fields(b jsonb,m jsonb,l jsonb,p text[] default '{}')
returns jsonb language plpgsql immutable set search_path='' as $$
declare k text; result jsonb='[]'; v jsonb; entries jsonb='[]'; formats jsonb;
begin
 if cardinality(p)>30 then raise exception 'Content is too deeply nested.'; end if;
 if not exists(select 1 from (values(b #> p),(m #> p),(l #> p)) t(v) where t.v is not null and jsonb_typeof(t.v)<>'object') then
  for k in select distinct key from (values(b #> p),(m #> p),(l #> p)) t(v),lateral jsonb_object_keys(t.v) key loop
   if k in ('__proto__','prototype','constructor') then raise exception 'Unsupported content field.'; end if;
   if cardinality(p)=0 and k='_studio' then continue; end if;
   result=result || aiwise_private.approval_fields(b,m,l,p||k);
  end loop;
  return result;
 end if;
 foreach v in array array[b,m,l] loop
  select coalesce(jsonb_agg(f order by (f->'path')::text collate "C"),'[]') into formats
   from jsonb_array_elements(coalesce(v->'_studio'->'formats','[]')) f
   where f->>'slot'=p[1] and not exists(select 1 from generate_series(2,cardinality(p)) i where f->'path'->>(i-2) is distinct from p[i]);
  entries=entries || jsonb_build_array(case when v #> p is null then null else jsonb_build_object('value',v #> p,'formats',formats) end);
 end loop;
 return jsonb_build_array(jsonb_build_object('kind','field','path',to_jsonb(p),'before',entries->0,'mine',entries->1,'beta',entries->2));
end; $$;
create or replace function aiwise_private.approval_put(v jsonb,p text[],x jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
begin
 if cardinality(p)=0 then return x; end if;
 return jsonb_set(coalesce(v,'{}'),array[p[1]],aiwise_private.approval_put(v->p[1],p[2:],x));
end; $$;
create or replace function aiwise_private.approval_reordered(b jsonb,x jsonb)
returns boolean language sql immutable set search_path='' as $$
 select coalesce((select jsonb_agg(t.v order by t.n) from jsonb_array_elements(x) with ordinality t(v,n) where b @> jsonb_build_array(v)),'[]')
 is distinct from coalesce((select jsonb_agg(t.v order by t.n) from jsonb_array_elements(b) with ordinality t(v,n) where x @> jsonb_build_array(v)),'[]');
$$;
create or replace function aiwise_private.approval_merge(b jsonb,m jsonb,l jsonb,resolutions jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare units jsonb; u jsonb; bb jsonb=coalesce(b->'_studio'->'boxes','[]'); mb jsonb=coalesce(m->'_studio'->'boxes','[]'); lb jsonb=coalesce(l->'_studio'->'boxes','[]');
 bo jsonb; mo jsonb; lo jsonb; default_order jsonb; chosen_order jsonb; id text; entries jsonb; v jsonb;
 result jsonb='{}'; formats jsonb='[]'; boxes jsonb='[]'; chosen jsonb; resolution jsonb; used integer=0; matches integer; p text[];
begin
 if jsonb_typeof(resolutions) is distinct from 'array' or octet_length(resolutions::text)>2000000 then raise exception 'Invalid review choices.'; end if;
 units=aiwise_private.approval_fields(b,m,l);
 for id in select distinct value->>'id' from jsonb_array_elements(bb||mb||lb) loop
  entries='[]';
  foreach v in array array[bb,mb,lb] loop
   entries=entries || jsonb_build_array((select jsonb_build_object('value',x) from jsonb_array_elements(v) x where x->>'id'=id));
  end loop;
  units=units || jsonb_build_array(jsonb_build_object('kind','box','path',jsonb_build_array(id),'before',entries->0,'mine',entries->1,'beta',entries->2));
 end loop;
 select coalesce(jsonb_agg(x->'id'),'[]') into bo from jsonb_array_elements(bb) x;
 select coalesce(jsonb_agg(x->'id'),'[]') into mo from jsonb_array_elements(mb) x;
 select coalesce(jsonb_agg(x->'id'),'[]') into lo from jsonb_array_elements(lb) x;
 select coalesce(jsonb_agg(t.v order by t.n),'[]') into default_order from (select t.v,min(t.n) n from jsonb_array_elements(lo||mo) with ordinality t(v,n) group by t.v) t;
 chosen_order=default_order;
 if aiwise_private.approval_reordered(bo,mo) or aiwise_private.approval_reordered(bo,lo) then
  units=units || jsonb_build_array(jsonb_build_object('kind','order','path','["box-order"]'::jsonb,'before',jsonb_build_object('value',bo),'mine',jsonb_build_object('value',mo),'beta',jsonb_build_object('value',lo)));
 end if;
 for u in select jsonb_array_elements(units) loop
  if u->'mine'=u->'before' then chosen=u->'beta';
  elsif u->'beta'=u->'before' then chosen=u->'mine';
  elsif u->'mine'=u->'beta' then chosen=u->'beta';
  else
   select count(*),jsonb_agg(x)->0 into matches,resolution from jsonb_array_elements(resolutions) x where x->'kind'=u->'kind' and x->'path'=u->'path';
   if matches<>1 then raise exception 'Choose a version for every overlapping change.'; end if;
   used=used+1;
   if resolution->>'choice'='beta' then chosen=u->'beta';
   elsif resolution->>'choice'='draft' then chosen=u->'mine';
   elsif resolution->>'choice'='edit' and u->>'kind'='field' and jsonb_typeof(u->'mine'->'value')='string' and jsonb_typeof(u->'beta'->'value')='string' and jsonb_typeof(resolution->'text')='string' then
    chosen=jsonb_build_object('value',resolution->'text','formats','[]'::jsonb);
   else raise exception 'Unsupported review choice.'; end if;
  end if;
  if chosen='null'::jsonb then continue; end if;
  if u->>'kind'='order' then chosen_order=chosen->'value';
  elsif u->>'kind'='box' then boxes=boxes || jsonb_build_array(chosen->'value');
  else
   select array_agg(x order by n) into p from jsonb_array_elements_text(u->'path') with ordinality t(x,n);
   result=aiwise_private.approval_put(result,p,chosen->'value'); formats=formats || (chosen->'formats');
  end if;
 end loop;
 if used<>jsonb_array_length(resolutions) then raise exception 'Review choices include an unchanged or unknown field.'; end if;
 if b ? '_studio' or m ? '_studio' or l ? '_studio' or boxes<>'[]' or formats<>'[]' then
  select coalesce(jsonb_agg(x order by (x->>'slot') collate "C",(x->'path')::text collate "C"),'[]') into formats from jsonb_array_elements(formats) x;
  select coalesce(jsonb_agg(x order by t.n),'[]') into boxes from
   (select t.v,min(t.n) n from jsonb_array_elements(chosen_order||default_order) with ordinality t(v,n) group by t.v) t
   join lateral jsonb_array_elements(boxes) x on x->'id'=t.v;
  result=result || jsonb_build_object('_studio',jsonb_build_object('version',1,'formats',formats,'boxes',boxes));
 end if;
 return result;
end; $$;

create or replace function aiwise_private.prepare_content_approval(p_id uuid,p_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.workspace_submissions; latest jsonb; current_release uuid; b jsonb; m jsonb; english_release uuid;
begin
 if public.workspace_role() is distinct from 'admin' then raise exception 'Administrator permission is required.' using errcode='42501'; end if;
 select * into r from public.workspace_submissions where id=p_id;
 if not found or r.status<>'pending' or r.revision is distinct from p_revision then raise exception 'This request already changed. Refresh before reviewing.'; end if;
 select coalesce(bc.slots,s.slots),bc.submission_id into latest,current_release from public.workspace_content_sources s
 left join public.workspace_beta_content bc on (bc.course,bc.chapter,bc.locale)=(s.course,s.chapter,s.locale)
 where (s.course,s.chapter,s.locale)=(r.course,r.chapter,r.locale);
 if latest is null or r.base_slots is null then raise exception 'Original comparison data is unavailable. Request revision.'; end if;
 if r.locale='nl' then
  select submission_id into english_release from public.workspace_beta_content where course=r.course and chapter=r.chapter and locale='en';
  if english_release is distinct from r.source_release then raise exception 'English source changed. Request a translation revision.'; end if;
 end if;
 b=r.base_slots; m=r.slots;
 if r.course='common' and r.catalog_version=1 then b=aiwise_private.normalize_common_copy(r.chapter,b); m=aiwise_private.normalize_common_copy(r.chapter,m); end if;
 return jsonb_build_object('base',b,'draft',m,'latest',latest,'release',current_release);
end; $$;

create or replace function aiwise_private.apply_content_approval(p_id uuid,p_revision integer,p_expected_release uuid,p_expected_slots jsonb,p_resolutions jsonb,p_result jsonb,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.workspace_submissions; context jsonb; merged jsonb; reviewer text; unchanged boolean;
begin
 if public.workspace_role() is distinct from 'admin' then raise exception 'Administrator permission is required.' using errcode='42501'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 1 and 12000 then raise exception 'Enter a decision reason.'; end if;
 select * into r from public.workspace_submissions where id=p_id for update;
 -- Lock ordering matches the original localized approval and submission operations.
 if r.locale='nl' then perform pg_advisory_xact_lock(hashtextextended('aiwise-beta:'||r.course||':'||r.chapter||':en',0)); end if;
 perform pg_advisory_xact_lock(hashtextextended('aiwise-beta:'||r.course||':'||r.chapter||':'||r.locale,0));
 context=aiwise_private.prepare_content_approval(p_id,p_revision);
 if (context->>'release')::uuid is distinct from p_expected_release or context->'latest' is distinct from p_expected_slots then raise exception 'Beta changed while you were reviewing. Close this comparison and review again.'; end if;
 merged=aiwise_private.approval_merge(context->'base',context->'draft',context->'latest',p_resolutions);
 if merged is distinct from p_result then raise exception 'The preview no longer matches the server result. Reload and review again.'; end if;
 if octet_length(merged::text)>2000000 or not public.workspace_valid_content(merged,context->'latest') then raise exception 'Content structure changed. Request revision.'; end if;
 -- Canonicalize formatting order for equality; semantic no-ops do not create releases/jobs.
 unchanged=merged=aiwise_private.approval_merge(context->'latest',context->'latest',context->'latest','[]');
 if not unchanged then
  insert into public.workspace_beta_content(course,chapter,locale,submission_id,slots,source_release)
   values(r.course,r.chapter,r.locale,r.id,merged,r.source_release)
   on conflict(course,chapter,locale) do update set submission_id=excluded.submission_id,slots=excluded.slots,source_release=excluded.source_release,approved_at=now();
 end if;
 select coalesce(nullif(left(btrim(raw_user_meta_data->>'display_name'),80),''),'Administrator') into reviewer from auth.users where id=auth.uid();
 update public.workspace_submissions set status='approved',revision=revision+1,reviewer_id=auth.uid(),reviewer_name=reviewer,decision_reason=btrim(p_reason),decided_at=now(),
 approval_result=jsonb_build_object('base_release',p_expected_release,'base_slots',context->'latest','slots',merged,'resolutions',p_resolutions,'no_op',unchanged) where id=p_id;
 return p_id;
end; $$;

create or replace function public.workspace_prepare_content_approval(p_id uuid,p_revision integer)
returns jsonb language sql security invoker set search_path='' as $$select aiwise_private.prepare_content_approval(p_id,p_revision);$$;
create or replace function public.workspace_apply_content_approval(p_id uuid,p_revision integer,p_expected_release uuid,p_expected_slots jsonb,p_resolutions jsonb,p_result jsonb,p_reason text)
returns uuid language sql security invoker set search_path='' as $$select aiwise_private.apply_content_approval(p_id,p_revision,p_expected_release,p_expected_slots,p_resolutions,p_result,p_reason);$$;
revoke all on function aiwise_private.approval_fields(jsonb,jsonb,jsonb,text[]),aiwise_private.approval_put(jsonb,text[],jsonb),aiwise_private.approval_reordered(jsonb,jsonb),aiwise_private.approval_merge(jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function aiwise_private.prepare_content_approval(uuid,integer),aiwise_private.apply_content_approval(uuid,integer,uuid,jsonb,jsonb,jsonb,text),public.workspace_prepare_content_approval(uuid,integer),public.workspace_apply_content_approval(uuid,integer,uuid,jsonb,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function aiwise_private.prepare_content_approval(uuid,integer),aiwise_private.apply_content_approval(uuid,integer,uuid,jsonb,jsonb,jsonb,text),public.workspace_prepare_content_approval(uuid,integer),public.workspace_apply_content_approval(uuid,integer,uuid,jsonb,jsonb,jsonb,text) to authenticated;
create or replace function public.workspace_studio_capabilities() returns jsonb
language sql immutable set search_path='' as $$select '{"blocks":1,"approval_merge":1}'::jsonb$$;
notify pgrst,'reload schema';
commit;
