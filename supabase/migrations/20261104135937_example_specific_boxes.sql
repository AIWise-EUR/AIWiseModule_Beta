-- Example-specific boxes. Validators only: no authored rows or approvals are rewritten.
-- Deploy BOTH Edge Function validators before running this activation.
begin;
create or replace function aiwise_private.valid_studio_extension(ext jsonb,slots jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare f jsonb; b jsonb; r jsonb; k text; p text[]; txt jsonb; joined text; ids text[]:='{}'; paths text[]:='{}'; placements text[]:='{}'; identity text;
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
  for k in select jsonb_object_keys(b) loop if k not in ('id','slot','template','anchor','fields','align','size','example','family') then return false; end if; end loop;
  if coalesce(b->>'id','') !~ '^box-[a-f0-9-]{36}$' or b->>'id'=any(ids) or not slots ? coalesce(b->>'slot','') or b->>'slot'='_studio' or
     coalesce(b->>'template','') not in ('gradient-row','fn-card','dual-card','sl-card','text') or
     jsonb_typeof(b->'anchor') is distinct from 'number' or (b->>'anchor') !~ '^[0-9]+$' or
     (b->>'anchor')::numeric>200 or coalesce(b->>'align','') not in ('left','center','right') or
     coalesce(b->'size','null'::jsonb) not in ('0','14','16','18','22','28','36') or
     jsonb_typeof(b->'fields') is distinct from 'array' then return false; end if;
  if jsonb_array_length(b->'fields') not between 1 and 100 or (b->>'template'='text' and jsonb_array_length(b->'fields')<>2) then return false; end if;
  for r in select value from jsonb_array_elements(b->'fields') loop if not aiwise_private.valid_studio_runs(r) then return false; end if; end loop;
  if b ? 'example' or b ? 'family' then
   if b->>'slot' is distinct from 'c2.examples' or b->>'template' is distinct from 'text' or b->'anchor' is distinct from '0'::jsonb or
      jsonb_typeof(b->'example') is distinct from 'number' or (b->>'example') !~ '^[0-9]+$' or
      jsonb_typeof(slots->'c2.examples') is distinct from 'array' or
      (b->>'example')::numeric >= jsonb_array_length(slots->'c2.examples') or
      jsonb_typeof(b->'family') is distinct from 'string' or coalesce(b->>'family','') !~ '^box-[a-f0-9-]{36}$' then return false; end if;
  end if;
  if b->>'slot'='c2.examples' and b->>'template'='text' then
   identity:=jsonb_build_array(coalesce(b->>'family',b->>'id'),coalesce(b->'example','0'::jsonb))::text;
   if identity=any(placements) then return false; end if;
   placements:=array_append(placements,identity);
  end if;
  ids:=array_append(ids,b->>'id');
 end loop;
 return true;
exception when others then return false;
end; $$;
revoke all on function aiwise_private.valid_studio_extension(jsonb,jsonb) from public,anon,authenticated;
create or replace function public.workspace_studio_capabilities() returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object(
  'example_boxes',1,
  'blocks',case when exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='aiwise_private' and p.proname='valid_studio_extension' and p.pronargs=2) then 1 else 0 end,
  'sat_phases',case when exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='aiwise_private' and p.proname='valid_sat_example' and p.pronargs=1) then 1 else 0 end,
  'approval_merge',case when
   exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='workspace_prepare_content_approval' and p.pronargs=2)
   and exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='workspace_apply_content_approval' and p.pronargs=7)
   and exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='aiwise_private' and p.proname='approval_merge' and p.pronargs=4)
   then 1 else 0 end
 );
$$;
revoke all on function public.workspace_studio_capabilities() from public;
grant execute on function public.workspace_studio_capabilities() to anon,authenticated;

notify pgrst,'reload schema';
commit;
