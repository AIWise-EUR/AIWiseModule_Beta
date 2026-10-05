-- Empty Psychology SAT authoring fields; no submitted or approved copy is rewritten.
-- Owner: run in Dashboard after the matching development source is deployed.
begin;
lock table public.workspace_submissions in share row exclusive mode;
lock table public.workspace_beta_content in share row exclusive mode;
lock table public.workspace_content_sources in share row exclusive mode;
do $$
declare missing boolean;
begin
 if (select count(*) from public.workspace_content_sources where course='psychology' and chapter='c2' and locale in ('en','nl')) <> 2 then
  raise exception 'Psychology C2 sources are not configured for both languages.';
 end if;
 select exists(select 1 from public.workspace_content_sources where course='psychology' and chapter='c2' and locale in ('en','nl') and not(slots ? 'c2.sat_example' and slots ? 'c2.sat_example_title')) into missing;
 if missing and exists(select 1 from public.workspace_submissions where course='psychology' and chapter='c2' and status='pending') then
  raise exception 'Psychology C2 now has a pending request. Review its compatibility before adding source fields; no changes were applied.';
 end if;
 if missing and exists(select 1 from public.workspace_beta_content where course='psychology' and chapter='c2') then
  raise exception 'Psychology C2 now has an approved copy. Prepare a compatible extension before adding source fields; no changes were applied.';
 end if;
end $$;
update public.workspace_content_sources
set slots=$template${
  "c2.sat_example_title": "S.A.T worked example",
  "c2.sat_example": {
    "phases": [
      {
        "label": "Self–AI",
        "steps": [
          {
            "actor": "self",
            "name": "Intent",
            "text": ""
          },
          {
            "actor": "ai",
            "name": "Operationalize",
            "text": ""
          },
          {
            "actor": "self",
            "name": "Judge",
            "text": ""
          },
          {
            "actor": "ai",
            "name": "Refine",
            "text": ""
          }
        ]
      },
      {
        "label": "Self–Team",
        "steps": [
          {
            "actor": "self",
            "name": "Present",
            "text": ""
          },
          {
            "actor": "team",
            "name": "Feedback",
            "text": ""
          },
          {
            "actor": "self",
            "name": "Integrate",
            "text": ""
          },
          {
            "actor": "team",
            "name": "Expand",
            "text": ""
          }
        ]
      },
      {
        "label": "Self–AI",
        "steps": [
          {
            "actor": "self",
            "name": "Intent",
            "text": ""
          },
          {
            "actor": "ai",
            "name": "Operationalize",
            "text": ""
          },
          {
            "actor": "self",
            "name": "Judge",
            "text": ""
          },
          {
            "actor": "ai",
            "name": "Refine",
            "text": ""
          }
        ]
      }
    ],
    "note": ""
  }
}$template$::jsonb || slots
where course='psychology' and chapter='c2' and locale in ('en','nl')
  and not(slots ? 'c2.sat_example' and slots ? 'c2.sat_example_title');
commit;
