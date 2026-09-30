# Content languages: manual SQL rollout

This change adds English/Nederlands translation spaces to the existing studios, completes the C1–C3 content catalog and C1 system map, and separates language-specific review and Beta feedback. It does not create Dutch translations, alter team roles, or publish the student-facing site.

## Apply and deploy together

The project administrator applies SQL. Codex must not apply this migration to the live project.

1. Keep the paired frontend PR ready, but do not merge it yet. Confirm the four existing membership, shared Studio, Common Studio and Beta feedback migrations are already installed.
2. In Supabase SQL Editor, run the entire new file `migrations/20260930062634_orientation_content_languages.sql` once. It runs in one transaction. Do not rerun older migrations or run individual fragments.
3. Report success so the paired frontend can be merged into `development` and deployed through the existing GitHub Pages workflow. This catalog expansion is not compatible with an indefinitely cached old Common renderer: the old UI may show a load warning or reject a draft during the interval between SQL and frontend deployment. Schedule both steps together, and avoid editing/submitting during that interval.
4. Reload Workspace and Beta after Pages finishes. A SQL success alone does not verify a frontend deployment.

If SQL reports an error, stop and retain its error message. Do not drop tables or reset data. This migration is intentionally not rerunnable. Preserve the existing project backup/recovery arrangement before applying any schema migration.

## Read-only SQL checks

```sql
select locale, count(*) as source_rows
from public.workspace_content_sources group by locale order by locale;
-- Expected: en = 10, nl = 10.

select course, chapter, locale, submission_id, source_release
from public.workspace_beta_content order by course, chapter, locale;
-- Existing English releases remain. The migration creates no approved Dutch release.

select proname, prosecdef
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and proname in
 ('workspace_submit_localized_content','workspace_submit_content','workspace_decide_content');
-- All three public entry points use invoker rights (prosecdef = false).
```

Run Supabase Security Advisor after the SQL change and review any findings. Live Advisor, live SQL and real-account review are not verified by the local tests.

## Data and access changes

Content sources, submissions and approved Beta rows now carry `locale`. Existing rows default to `en`. Dutch submissions remember the English release they were reviewed against; server checks reject stale references. Per-language locks protect approval from concurrent updates. The old English RPC stays available, while the UI uses the localized RPC.

The source catalog becomes publicly readable, matching the static module and approved Beta text it contains. It includes no draft or author data. It remains unwritable by ordinary clients. Submissions, comments and author information remain member-only under existing RLS. The two privileged content operations live in the private schema with membership/admin checks and an empty search path; only their guarded entry points are executable by authenticated clients. Existing feedback trigger functions remain non-callable.

Old Common submitted snapshots are not rewritten. Source and active Beta catalogs normalize entity-split text and add newly editable supporting copy. Pending legacy requests are adapted at approval. The original request stays unchanged. English course content and English feedback keys are retained. Other courses starts from the same original AWS1 defaults that it previously inherited; approving AWS1 content does not overwrite Other courses.

## Verify after deployment

- Open Common Studio, switch English/Nederlands, edit and save one real intended translation. Reopen and confirm English is unchanged. Check Show English source and the C1 system map item group.
- Open AWS1, PED and Other courses in Content Studio; verify their configured C2/C3 examples and language-specific saved drafts.
- With an approved team member, submit an intended translation. Verify it is visible to another member and cannot be approved by a regular member. With an administrator, use the normal review decision only when the content is ready.
- In Beta, select the same language/course/page and verify approved content after reload. Before a Dutch approval, the fallback notice must remain visible; English seed text is not a finished translation.
- Verify language-specific comment/reply/resolved status with real intended feedback. Do not create live test users or sample feedback merely for verification.
- Verify source-change review with a legitimate subsequent English edit: Dutch submission should require source review, and the server should reject an already pending translation with the older English reference.

## Local verification

Dependencies: Node.js, `linkedom@0.18.12`, `@electric-sql/pglite@0.3.14`. Install outside the production files. Point `LINKEDOM_MODULE` and `PGLITE_MODULE` to those packages, or use a suitable `NODE_PATH`.

```sh
node --test workspace/tests/content-languages.test.cjs workspace/tests/common-studio.test.cjs workspace/tests/beta-review.test.cjs
node supabase/tests/content_languages.cjs
node supabase/tests/shared_studio.cjs
node supabase/tests/common_studio.cjs
node supabase/tests/beta_feedback.cjs
```

The new SQL test applies all migrations to an isolated PostgreSQL instance with existing English approved/pending content, verifies the full source catalogs, independent languages, stale-source rejection, role checks, immutable copies, retry safety and feedback isolation. Historical suites retain their earlier migration scope. Browser verification uses local-only fixtures for editor save/reload, source review, translation previews, the map, and narrow layouts. It does not claim live Supabase or GitHub Pages verification.
