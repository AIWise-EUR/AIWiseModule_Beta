# Workspace readiness and DPAS activation

Prepared 2026-11-04 (Korea). **Server changes and DPAS activation are pending.**
The approval UI hotfix can deploy independently and calls the already installed,
administrator-guarded comparison RPC. Do not approve or overwrite live requests as
a setup test. The real C1/C2/C3 Dutch requests remain pending.

## Apply the reviewed server package

The repository's AGENTS.md assigns SQL and Edge Function deployment to the owner.
Apply this during a short coordinated window: avoid creating new review versions
or publishing until server setup and DPAS registry deployment are both verified.
The existing student release remains unchanged throughout this setup.

1. In project `cvcvdiohckwgpgoxibia`, SQL Editor, run
   [`WORKSPACE_READINESS_SETUP.sql`](WORKSPACE_READINESS_SETUP.sql) in full.
   It repairs the capability report and inserts DPAS scope plus C2/C3 English/Dutch
   source catalogs. It does not update existing source rows, submissions or releases.
   Re-running it preserves authored DPAS source rows.
2. Create/deploy **`workspace-courses`**, with **Verify JWT enabled**, using
   [`functions/workspace-courses/index.ts`](functions/workspace-courses/index.ts).
   The existing GitHub App project secrets are reused. Follow
   [`WORKSPACE_COURSES_SETUP.md`](WORKSPACE_COURSES_SETUP.md) for that function.
   Do not replace `GitHub-Publish` or `aiwise-release`.
3. Verify the SQL below; then merge the prepared DPAS registry/content branch and
   confirm its Beta Pages deployment. The registry change must not deploy alone.
4. Run `checks/live-check.ts` using the command in its header. It now checks all
   capability flags, the registration endpoint, and every scope/chapter/language
   catalog, in addition to the existing Beta and Published checks.

```sql
select public.workspace_studio_capabilities();
-- Expected: blocks=1, sat_phases=1, approval_merge=1.

select id, kind, name, retired
from public.workspace_content_scopes where id='dpas';
-- Expected: dpas, bachelor, DPAS, false.

select chapter, locale
from public.workspace_content_sources where course='dpas'
order by chapter, locale;
-- Expected: c2/en, c2/nl, c3/en, c3/nl.
```

## Verify as an administrator

- Reopen one of the existing Dutch requests. **Approve & apply to Beta** should
  open the comparison and final preview. The owner/reviewer makes the actual
  content approval decision; setup checks stop at preview.
- Courses → Refresh shared list should succeed. DPAS / Skills appears from the
  prepared registry; no duplicate manual registration is needed. The original
  browser-only course can remain as a backup. If it is registered with the same
  bachelor, ID and names, the server treats it as an identical retry.
- Open DPAS in Content Studio. Its examples start empty, independent of Psychology
  and Pedagogical Sciences. Save drafts normally. The copied English structural
  labels are template headings, not DPAS-authored learning content.
- A new publish review must be created after DPAS activation. An old saved review
  does not contain DPAS. Do not edit a historical review to insert it silently.
- Publish to students only after the course content has been authored and reviewed.

## Capability regression and future migrations

The SAT installer replaced the same capability function earlier used by approval,
leaving `{blocks:1,sat_phases:1}` despite the approval RPCs remaining installed.
This repair centralizes the report and derives flags from installed implementations.
Do not define a separate partial constant capability JSON in each new migration.

Historical installer scripts remain historical. If an old full installer must be
rerun, apply this repair last and run the complete contract tests. Do not blindly
rerun the entire old approval installer in response to a missing flag.

The new full migration-chain test reproduces the original regression, applies this
repair, checks all flags as anon/authenticated, approves a synthetic Dutch request
and a DPAS update locally, rejects anonymous writes, and verifies repeat-safe
preservation. Browser tests additionally verify the DPAS editor uses its own blank
template. No synthetic content is written to the live project.

## Verification snapshot

Prepared tree: all 51 repository test files passed. The real Workspace browser
fixture opened DPAS using its own blank examples, and the approval modal fixture
passed. Three real pending Dutch snapshots produced zero conflicts and identical
JavaScript/SQL merges in an isolated test; their live decisions remain unchanged.

The expanded read-only live check, run through the environment proxy on 2026-11-04,
reported 6 passes and 4 expected readiness failures: missing approval flag, absent
registration endpoint, absent DPAS catalogs, and absent DPAS scope. The latter two
compare the prepared DPAS registry against the not-yet-updated server. Existing
commit/release workers and the student V9 release passed. This is why the DPAS
branch is held until coordinated server activation.
