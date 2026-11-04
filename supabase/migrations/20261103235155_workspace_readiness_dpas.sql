-- Repair capability drift and initialize the independent DPAS content scope.
-- Existing submissions, approvals, releases and authored DPAS source rows stay untouched.
begin;
create or replace function public.workspace_studio_capabilities() returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object(
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

insert into public.workspace_content_scopes(id,kind,name,retired)
values('dpas','bachelor','DPAS',false) on conflict(id) do nothing;
do $$ begin
 if not exists(select 1 from public.workspace_content_scopes where id='dpas' and kind='bachelor' and not retired and name='DPAS') then
  raise exception 'DPAS scope already exists with different settings; review it before continuing.';
 end if;
end $$;

insert into public.workspace_content_sources(course,chapter,locale,slots)
select 'dpas','c2',locale,$dpas${
  "c2.sat_example_title": "",
  "c2.sat_example": {
    "phases": [],
    "note": ""
  },
  "c2.examples": [
    {
      "title": "",
      "thinking": "",
      "typing_note": "",
      "typing": "",
      "processing": ""
    }
  ]
}$dpas$::jsonb from (values('en'),('nl')) l(locale)
on conflict(course,chapter,locale) do nothing;

insert into public.workspace_content_sources(course,chapter,locale,slots)
select 'dpas','c3',locale,$dpas${
  "c3.techniques.clear_instruction": {
    "bad": "",
    "good": ""
  },
  "c3.full_example_title": "",
  "c3.critique.verify": "",
  "c3.techniques.output_format": {
    "bad": "",
    "good": ""
  },
  "c3.amd_example": {
    "title": "",
    "intro": "",
    "items": [
      {
        "text": "",
        "tag": "",
        "reason": ""
      },
      {
        "text": "",
        "tag": "",
        "reason": ""
      },
      {
        "text": "",
        "tag": "",
        "reason": ""
      }
    ]
  },
  "c3.critique.question": "",
  "c3.techniques.few_shot": {
    "good": ""
  },
  "c3.techniques.role": {
    "bad": "",
    "good": ""
  },
  "c3.template_compare.md": [
    {
      "heading": "Role",
      "lines": [
        ""
      ]
    },
    {
      "heading": "Task",
      "lines": [
        ""
      ]
    },
    {
      "heading": "Context",
      "lines": [
        ""
      ]
    },
    {
      "heading": "Constraints",
      "lines": [
        "",
        ""
      ]
    },
    {
      "heading": "Output Format",
      "lines": [
        ""
      ]
    }
  ],
  "c3.critique.decide": "",
  "c3.critique.read": "",
  "c3.techniques.chain_of_thought": {
    "bad": "",
    "good": ""
  },
  "c3.full_example": [
    {
      "tag": "role",
      "lines": [
        "",
        ""
      ]
    },
    {
      "tag": "task",
      "lines": [
        "",
        "",
        ""
      ]
    },
    {
      "tag": "context",
      "lines": [
        "",
        "",
        "",
        ""
      ]
    },
    {
      "tag": "constraints",
      "lines": [
        "",
        "",
        ""
      ]
    },
    {
      "tag": "steps",
      "lines": [
        "",
        "",
        ""
      ]
    },
    {
      "tag": "examples",
      "lines": [
        "",
        "",
        ""
      ]
    },
    {
      "tag": "output_format",
      "lines": [
        "",
        "",
        ""
      ]
    }
  ],
  "c3.techniques.task_decomposition": {
    "bad": "",
    "good": ""
  },
  "c3.template_compare.xml": [
    {
      "tag": "role",
      "lines": [
        ""
      ]
    },
    {
      "tag": "task",
      "lines": [
        ""
      ]
    },
    {
      "tag": "context",
      "lines": [
        ""
      ]
    },
    {
      "tag": "constraints",
      "lines": [
        "",
        ""
      ]
    },
    {
      "tag": "output_format",
      "lines": [
        ""
      ]
    }
  ]
}$dpas$::jsonb from (values('en'),('nl')) l(locale)
on conflict(course,chapter,locale) do nothing;

notify pgrst,'reload schema';
commit;
