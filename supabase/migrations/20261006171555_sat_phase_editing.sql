-- Validation-only change; existing drafts, requests, approvals and snapshots are not rewritten.
begin;
create or replace function aiwise_private.valid_sat_example(value jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare phase jsonb; step jsonb;
begin
 if jsonb_typeof(value) is distinct from 'object' or not value ?& array['phases','note'] or
    value - array['phases','note'] <> '{}'::jsonb or jsonb_typeof(value->'note') is distinct from 'string' or
    length(value->>'note')>100000 or jsonb_typeof(value->'phases') is distinct from 'array' then return false; end if;
 if jsonb_array_length(value->'phases')>50 then return false; end if;
 for phase in select * from jsonb_array_elements(value->'phases') loop
  if jsonb_typeof(phase) is distinct from 'object' or not phase ?& array['label','steps'] or
     phase - array['label','steps'] <> '{}'::jsonb or jsonb_typeof(phase->'label') is distinct from 'string' or
     length(phase->>'label')>100000 or jsonb_typeof(phase->'steps') is distinct from 'array' then return false; end if;
  if jsonb_array_length(phase->'steps')<>4 then return false; end if;
  for step in select * from jsonb_array_elements(phase->'steps') loop
   if jsonb_typeof(step) is distinct from 'object' or not step ?& array['actor','name','text'] or
      step - array['actor','name','text'] <> '{}'::jsonb or coalesce(step->>'actor','') not in ('self','ai','team') or
      jsonb_typeof(step->'name') is distinct from 'string' or jsonb_typeof(step->'text') is distinct from 'string' or
      length(step->>'name')>100000 or length(step->>'text')>100000 then return false; end if;
  end loop;
 end loop;
 return true;
exception when others then return false;
end; $$;
create or replace function public.workspace_valid_content(value jsonb,baseline jsonb,field text default '') returns boolean
language plpgsql immutable set search_path='' as $$
declare k text; v jsonb; i integer; is_root boolean;
begin
 if field='c2.sat_example' then return aiwise_private.valid_sat_example(value) and aiwise_private.valid_sat_example(baseline); end if;
 if value is null or baseline is null or jsonb_typeof(value)<>jsonb_typeof(baseline) then return false; end if;
 if jsonb_typeof(baseline)='string' then
  if length(value#>>'{}')>100000 then return false; end if;
  if field='actor' and baseline#>>'{}' in ('student','ai') then return value#>>'{}' in ('student','ai'); end if;
  if field='tag' and baseline#>>'{}' in ('adopt','modify','discard') then return value#>>'{}' in ('adopt','modify','discard'); end if;
  return true;
 elsif jsonb_typeof(baseline)='array' then
  if field='c2.examples' then
   if jsonb_array_length(value) not between 1 and 50 or jsonb_array_length(baseline)=0 then return false; end if;
   for i in 0..jsonb_array_length(value)-1 loop if not public.workspace_valid_content(value->i,baseline->0) then return false; end if; end loop;
  else
   if jsonb_array_length(value)<>jsonb_array_length(baseline) then return false; end if;
   for i in 0..jsonb_array_length(baseline)-1 loop if not public.workspace_valid_content(value->i,baseline->i) then return false; end if; end loop;
  end if;
  return true;
 elsif jsonb_typeof(baseline)='object' then
  is_root:=field='' and exists(select 1 from jsonb_object_keys(baseline) t(k) where t.k ~ '^(c[123]|map)\.');
  if is_root and not aiwise_private.valid_studio_extension(value->'_studio',value) then return false; end if;
  for k,v in select * from jsonb_each(baseline) loop
   if is_root and k='_studio' then continue; end if;
   if k='typing_note' and not value ? k and baseline ? 'typing' then continue; end if;
   if not public.workspace_valid_content(value->k,v,k) then return false; end if;
  end loop;
  for k in select jsonb_object_keys(value) loop
   if is_root and k='_studio' then continue; end if;
   if not baseline ? k and not(k='typing_note' and baseline ? 'typing' and jsonb_typeof(value->k)='string' and length(value->>k)<=100000) then return false; end if;
  end loop;
  return true;
 end if;
 return value=baseline;
end; $$;
create or replace function public.workspace_studio_capabilities() returns jsonb
language sql immutable set search_path='' as $$select '{"blocks":1,"sat_phases":1}'::jsonb$$;
revoke all on function aiwise_private.valid_sat_example(jsonb),public.workspace_valid_content(jsonb,jsonb,text) from public,anon,authenticated;
revoke all on function public.workspace_studio_capabilities() from public;
grant execute on function public.workspace_studio_capabilities() to anon,authenticated;
notify pgrst,'reload schema';
commit;
