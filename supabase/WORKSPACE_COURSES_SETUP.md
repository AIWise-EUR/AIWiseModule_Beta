# Shared course registration

Prepared 2026-11-02. **Owner deployment required; no SQL to run.**

The Workspace now registers a course in `common/courses/registry.json` on
`AIWise-EUR/AIWiseModule_Beta` → `development`. Content Studio reads that same list.
This replaces the old browser-only Add course operation. Existing browser entries
are retained byte-for-byte and can be registered with a chosen bachelor.

## Apply in the Supabase Dashboard

1. Open project `cvcvdiohckwgpgoxibia` → **Edge Functions** → create a function
   using the editor. Name it exactly **`workspace-courses`** (lowercase).
2. Replace `index.ts` with the complete contents of
   [`functions/workspace-courses/index.ts`](functions/workspace-courses/index.ts).
   The file is self-contained; no extra imports or SQL migrations are needed.
3. Keep **Verify JWT enabled**. Deploy the new function. Do not replace
   `GitHub-Publish` or `aiwise-release`.
4. It uses the existing project secrets `AIWISE_GITHUB_CLIENT_ID` and
   `AIWISE_GITHUB_PRIVATE_KEY`. The GitHub App must already have Contents write
   permission on `AIWise-EUR/AIWiseModule_Beta`. Do not paste secrets into source
   files or chat. No service-role key is used by this function.

## Verify after deployment

Run the repository's read-only `checks/live-check.ts` command (see its header).
Then, as an active Workspace administrator:

1. Open **Courses** → **Refresh shared list**. It should say the shared list is up
   to date. An absent function displays setup guidance; it cannot claim a local save.
2. For a previously added course, use its original browser → open that course →
   **Register with team**. Its names are prefilled. Choose its **actual bachelor**,
   verify the ID, then register. For a new course use **Add course**.
3. Open **Content Studio**. The course appears under the selected bachelor and
   opens that bachelor's C2/C3 editor. A second administrator account should see
   it after opening Studio or refreshing the shared list.
4. The course registration commit triggers Beta Pages deployment. The module
   course chooser catches up when that deployment completes. Publishing to the
   student site remains a separate, existing release operation.

**DPAS's bachelor has not been confirmed.** The existing bachelors are Psychology
and Pedagogical Sciences. Do not choose one merely to pass validation. If DPAS
needs another bachelor, first set up its content files and database content scope;
this function deliberately cannot create arbitrary scopes or course overrides.

## Safety and troubleshooting

- The server checks the bearer token with Auth and the current `workspace_role()`
  before reading and again immediately before a write. Only active admins qualify.
- Only one fixed JSON path and branch can be written. Requests cannot choose a
  repository, path, commit author, content source or arbitrary registry properties.
- A registry SHA prevents concurrent overwrites. On conflict refresh, review the
  still-filled fields and save again. Names can change; bachelor and ID stay fixed.
- A retry with identical existing course details succeeds without another commit.
  No drafts, approvals, activity files, private account data or student releases
  are included in the registration commit.
- A local migration records only a mapping beside the original browser key. The
  original `aiwise_workspace_courses_v1` value remains intact. If that mapping
  cannot be stored, the local backup remains visible alongside the team course.
- To disable writes, remove/disable this new function. The public registry and
  Studio continue to load from the deployed static site; registration reports an
  error instead of reverting to browser-only saving. Do not delete legacy data.

## Validation record

Local server tests cover authorization/revocation, allowed path/branch, input
validation, cross-account reads, name updates preserving metadata, stale writes,
conflicts and lost-response retries. Browser fixtures use two isolated sessions
against a simulated server; they do not register test courses in the live project.
Live authenticated registration remains pending owner deployment and use with the
course's confirmed bachelor.
