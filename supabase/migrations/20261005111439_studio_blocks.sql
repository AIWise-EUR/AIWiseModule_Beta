-- Additive validation only: no content, drafts, submissions, decisions or releases are rewritten.
begin;
create or replace function aiwise_private.valid_studio_runs(runs jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare r jsonb; k text;
begin
 if jsonb_typeof(runs) is distinct from 'array' or jsonb_array_length(runs) not between 1 and 2000 then return false; end if;
 for r in select value from jsonb_array_elements(runs) loop
  if jsonb_typeof(r) is distinct from 'object' or jsonb_typeof(r->'text') is distinct from 'string' or length(r->>'text')>100000 then return false; end if;
  for k in select jsonb_object_keys(r) loop
   if k not in ('text','bold','italic','color','size') then return false; end if;
  end loop;
  if (r ? 'bold' and jsonb_typeof(r->'bold')<>'boolean') or (r ? 'italic' and jsonb_typeof(r->'italic')<>'boolean') or
     (r ? 'color' and (jsonb_typeof(r->'color')<>'string' or r->>'color' !~ '^#[0-9a-fA-F]{6}$')) or
     (r ? 'size' and r->'size' not in ('14','16','18','22','28','36')) then return false; end if;
 end loop;
 return true;
end; $$;
create or replace function aiwise_private.valid_studio_extension(ext jsonb,slots jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare f jsonb; b jsonb; r jsonb; k text; p text[]; txt jsonb; joined text; ids text[]:='{}'; paths text[]:='{}'; identity text;
begin
 if ext is null then return true; end if;
 if jsonb_typeof(ext) is distinct from 'object' or ext->'version' is distinct from '1'::jsonb or
    jsonb_typeof(ext->'formats') is distinct from 'array' or jsonb_typeof(ext->'boxes') is distinct from 'array' then return false; end if;
 if jsonb_array_length(ext->'formats')>2000 or jsonb_array_length(ext->'boxes')>50 then return false; end if;
 for k in select jsonb_object_keys(ext) loop if k not in ('version','formats','boxes') then return false; end if; end loop;
 for f in select value from jsonb_array_elements(ext->'formats') loop
  if jsonb_typeof(f) is distinct from 'object' or jsonb_typeof(f->'slot') is distinct from 'string' or not slots ? (f->>'slot') or
     f->>'slot'='_studio' or jsonb_typeof(f->'path') is distinct from 'array' or jsonb_array_length(f->'path')>10 or not aiwise_private.valid_studio_runs(f->'runs') then return false; end if;
  for k in select jsonb_object_keys(f) loop if k not in ('slot','path','runs') then return false; end if; end loop;
  for r in select value from jsonb_array_elements(f->'path') loop
   if jsonb_typeof(r)<>'string' or r#>>'{}' in ('__proto__','constructor','prototype') then return false; end if;
  end loop;
  select coalesce(array_agg(value),'{}') into p from jsonb_array_elements_text(f->'path');
  txt := (slots->(f->>'slot')) #> p;
  select coalesce(string_agg(value->>'text','' order by ord),'') into joined from jsonb_array_elements(f->'runs') with ordinality a(value,ord);
  identity := (f->'slot')::text || (f->'path')::text;
  if jsonb_typeof(txt) is distinct from 'string' or txt#>>'{}' is distinct from joined or identity=any(paths) then return false; end if;
  paths:=array_append(paths,identity);
 end loop;
 for b in select value from jsonb_array_elements(ext->'boxes') loop
  if jsonb_typeof(b) is distinct from 'object' then return false; end if;
  for k in select jsonb_object_keys(b) loop if k not in ('id','slot','template','anchor','fields','align','size') then return false; end if; end loop;
  if coalesce(b->>'id','') !~ '^box-[a-f0-9-]{36}$' or b->>'id'=any(ids) or not slots ? coalesce(b->>'slot','') or b->>'slot'='_studio' or
     coalesce(b->>'template','') not in ('gradient-row','fn-card','dual-card','sl-card','text') or
     jsonb_typeof(b->'anchor') is distinct from 'number' or (b->>'anchor') !~ '^[0-9]+$' or
     (b->>'anchor')::numeric>200 or coalesce(b->>'align','') not in ('left','center','right') or
     coalesce(b->'size','null'::jsonb) not in ('0','14','16','18','22','28','36') or
     jsonb_typeof(b->'fields') is distinct from 'array' then return false; end if;
  if jsonb_array_length(b->'fields') not between 1 and 100 or (b->>'template'='text' and jsonb_array_length(b->'fields')<>2) then return false; end if;
  for r in select value from jsonb_array_elements(b->'fields') loop if not aiwise_private.valid_studio_runs(r) then return false; end if; end loop;
  ids:=array_append(ids,b->>'id');
 end loop;
 return true;
exception when others then return false;
end; $$;
create or replace function public.workspace_valid_content(value jsonb,baseline jsonb,field text default '') returns boolean
language plpgsql immutable set search_path='' as $$
declare k text; v jsonb; i integer; is_root boolean;
begin
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
-- Capability is public metadata, not an authorization bypass. Existing submit/decide RPCs keep their role, ownership and stale-version checks.
create or replace function public.workspace_studio_capabilities() returns jsonb
language sql immutable set search_path='' as $$select '{"blocks":1}'::jsonb$$;
revoke all on function aiwise_private.valid_studio_runs(jsonb),aiwise_private.valid_studio_extension(jsonb,jsonb),public.workspace_valid_content(jsonb,jsonb,text) from public,anon,authenticated;
revoke all on function public.workspace_studio_capabilities() from public;
grant execute on function public.workspace_studio_capabilities() to anon,authenticated;
notify pgrst,'reload schema';
commit;
