# Beta → Published releases

This is separate from Studio → Beta automatic commits. An administrator reviews the **accumulated approved Beta content**, checks its publication copy, and explicitly approves **Publish to students**. Publish creates the numbered, dated version. The worker commits the frozen package to `AIWise-EUR/AI-Wise`, branch `main`. GitHub Pages hosting stays unchanged.

## Apply once in Supabase

Project: `cvcvdiohckwgpgoxibia`. Apply after the existing review-version and GitHub publishing migrations. No student content is published merely by completing setup.

1. **SQL Editor**: run the complete file `migrations/20261001061946_workspace_published_releases.sql`. This creates the private release queue and administrator-only approval functions. Do not paste SQL into an Edge Function.
2. **Edge Functions → Create function**: create the actual function URL slug **`aiwise-release`**, paste `functions/aiwise-release/index.ts` into `index.ts`, set **Verify JWT OFF**, then deploy. Changing only a function's display name does not change its URL. The endpoint must end in `/functions/v1/aiwise-release`.
3. Existing project secrets **`AIWISE_GITHUB_CLIENT_ID`** and **`AIWISE_GITHUB_PRIVATE_KEY`** are reused. The installed GitHub App needs access to **both** `AIWiseModule_Beta` and `AI-Wise`, with **Contents: Read and write** and **Actions: Read-only**. No installation-ID secret is required. Repository rules must allow the App to update `AI-Wise/main`; do not disable branch protections to work around a failed release.
4. **SQL Editor**: run `ENABLE_PUBLISHED_RELEASES.sql`. It creates a separate Vault worker secret, enables publishing, and schedules recovery/status checks every minute. Its trigger starts queued approvals promptly. An idle schedule does not invoke the function. This does not change the existing `GitHub-Publish` function or its schedule.

Verify JWT is off because scheduled requests do not carry a user's JWT. Authentication is still required: browser preparation validates the Supabase user and current administrator role; scheduled requests validate a separate Vault-held secret. SQL approval checks the current administrator again. Ordinary members cannot read the release records or approve publication.

## Use in Workspace

1. In **AI-Wise Beta**, open the current preview and finish the team review. Earlier versions remain available in a collapsed list.
2. Open **Publish…** (also available at **Control Tower → Beta → Published**).
3. Choose **Review publication**. This prepares the content and opens final confirmation; it does not write to GitHub. An existing matching prepared copy is reused.
4. Confirm **Publish to students**. This saves the numbered version and starts publication.
5. Follow the visual steps: review and confirmation → GitHub update → website live. Commit success and Pages deployment success are separate; links open the actual commit and deployment run.

Prepared copies do not appear in publication history. If an earlier approval failed with `DELETE requires a WHERE clause`, apply `PUBLISH_APPROVAL_FIX.sql` in the SQL Editor. This preserves safe-update protection and scopes temporary-review cleanup to the publication cutoff. It replaces the approval function without publishing anything; no Edge Function redeployment is required.

A site change after preparation stops the release with “The student site changed. Prepare a new release.” Review and prepare again. Connection failures retry with bounded backoff; failed jobs offer Retry publish. A deployment failure does not repeat the commit—use Deployment details to investigate the Pages run.

## Included content and compatibility

- All saved English Common C1/C2/C3/system-map content and AWS1/PED/Other C2/C3 course examples.
- Approved Dutch content in the selected version. Missing Dutch chapters use that version's saved English content, with the existing visible notice.
- Exactly eleven allowlisted flat files: four orientation HTML pages, six paired browser scripts, and `published-content.json`. Existing student URLs, landing pages, activity pages and unrelated files remain in the target tree.
- No review comments, names, email addresses, review titles or summaries are included in the student package. The existing public student feedback widget remains available.
- Student pages read the frozen release file only, without live Supabase or Beta content requests. The release ID prevents mixed cached HTML/data from silently showing another release.
- The module renderer and layout are captured from the exact Beta development commit **at preparation time**. Saved review versions currently freeze content, not historical HTML. Structurally incompatible versions are blocked and require a new review version.
- Preparing captures the current student commit. Publication uses a non-forced branch update, preserving unrelated files and rejecting concurrent target changes. Repeated delivery recovers an already committed release without creating another commit.

When orientation HTML or the Common catalog changes, regenerate `pipelines/orientation-schema.json` using `pipelines/build-orientation-schema.cjs` with LinkeDOM available, and run the bundle tests. A stale schema blocks preparation. Structural source changes may also require updating and redeploying `aiwise-release`; code is never generated by an LLM.

## Verification and recovery

Read-only SQL after setup:

```sql
select enabled, worker_secret_hash is not null as worker_configured
from aiwise_private.release_settings;
select jobname, schedule, active from cron.job
where jobname = 'aiwise-published-release';
select number, version_number, status, commit_sha, deployment_status, error_code
from public.workspace_releases order by number desc limit 10;
```

A successful scheduled invocation with no release jobs is only an idle check. Confirm the first real release by its GitHub commit, successful Pages run and student page content. To pause new processing without deleting history:

```sql
update aiwise_private.release_settings set enabled = false where singleton;
```

For rollback, select a previously reviewed compatible version and prepare a **new** release against the current student head, then approve it normally. This creates a visible forward commit. Deployment failures or incompatible historical HTML may require an administrator to revert the specific release commit in GitHub after reviewing later changes; never force-reset the branch.

## Local validation

`supabase/tests/published_releases.cjs` runs all migrations in a disposable PGlite database and checks real snapshot assembly, RLS, separate approval, leases, retries and scheduler triggers. `published_worker.test.mjs` covers the frozen bundle, server preparation, GitHub writes, concurrency, uncertain responses and Pages outcomes. `workspace/tests/published-release.test.cjs` covers UI authorization, missing setup, safe rendering and preparation without publication. Existing Workspace and Beta publishing tests remain applicable.
