# Automatic approved-content commits

## Apply in Supabase

Project: `cvcvdiohckwgpgoxibia`. Apply these steps as the project owner.
Keep the existing `clever-action` connection-check function unchanged.

1. In **SQL Editor**, run all of
   [`migrations/20261001051757_workspace_github_publishing.sql`](migrations/20261001051757_workspace_github_publishing.sql).
   This adds a durable approval queue and guarded status/retry functions. Processing
   starts disabled. Currently approved copies are queued for their initial commits.
2. In **Edge Functions**, create **`github-publish`**, paste all of
   [`functions/github-publish/index.ts`](functions/github-publish/index.ts), and deploy.
   Set **Verify JWT OFF for this new function only**. The scheduled database caller
   uses a random server-only secret instead of a user JWT. The function validates
   that secret against its stored hash; browser calls separately validate the user
   through Auth and check their current active administrator role. Turning off the
   gateway check does not make this handler accept unauthenticated requests.
3. In **SQL Editor**, run [`ENABLE_GITHUB_PUBLISHING.sql`](ENABLE_GITHUB_PUBLISHING.sql).
   This generates a random secret inside Vault, installs the automatic wake-up
   trigger, and schedules a recovery/status check every minute. Nothing sensitive
   needs to be copied into Workspace or chat. This step activates GitHub writes.

The existing project secrets `AIWISE_GITHUB_CLIENT_ID` and
`AIWISE_GITHUB_PRIVATE_KEY` are reused. Supabase supplies `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY` and the public key at runtime. The App installation
is discovered through GitHub; an installation ID secret is not needed.
The GitHub App must have access to `AIWiseModule_Beta`, **Contents: Read and write**
and **Actions: Read-only**. Branch rules must permit the App to append commits
to `development`. This function never bypasses branch protection.

## First verification

Approve one genuine saved Common Studio or Content Studio submission in Control
Tower. Open its request. The new **GitHub & deployment** section shows queued,
committing, committed and deployment statuses, with links to the exact commit and
Pages run. A successful database approval alone is not shown as deployed.

The server starts after the approval transaction commits and continues if the
browser closes. If the initial request is interrupted, the one-minute schedule
recovers it after its three-minute lease expires. Temporary errors back off; after
eight attempts the administrator sees **Retry commit**. A failed Pages deployment
has its own status and does not create another content commit.

Read-only SQL checks (no secrets in results):

```sql
select sequence,course,chapter,locale,status,attempts,error_code,
       commit_sha,deployment_status,deployment_run_id
from public.workspace_github_jobs order by sequence desc limit 20;

select jobname,schedule,active from cron.job where jobname='aiwise-github-publish';
```

To pause server writes while investigating, run:
```sql
update aiwise_private.github_settings set enabled=false where singleton;
```
Re-enable with `enabled=true`. Existing queued approvals are retained.

## Scope and data contract

- One fixed destination: **AIWise-EUR/AIWiseModule_Beta → development**.
- One generated JSON file per approved course/chapter/language:
  `content/approved/<en|nl>/<common|aws1|ped|other>/<chapter>.json`.
  Common includes C1, C2, C3 and the system map; course content includes C2/C3.
- The approved slots are copied from the database transaction. The browser cannot
  choose repository, branch, filename, commit message or content for the worker.
- Only public approved content and its version identifiers are committed. Names,
  email addresses, decision reasons, drafts, comments and replies stay out of Git.
- Supabase remains the live approved-content source. Pages also serves the
  committed JSON as an explicitly labelled outage fallback. Studio source
  baselines and immutable review versions never use that fallback.
- Latest branch trees and non-forced ref updates preserve concurrent code edits.
  Approval sequences prevent old workers overwriting newer approved artifacts.
  An uncertain response is recovered by recognizing the already committed file.
- Saved Beta review versions continue to be content snapshots in Supabase.
  They are not frozen HTML/CSS/asset builds.
- **AI-Wise/main and the student Published site are untouched.** This is the
  Studio approval → Beta commit path. A separate release approval/promotion path
  still needs implementation; it is not implied by the legacy release form.
- No OpenAI API, LLM, additional repository, webhook URL or GitHub Actions secret
  is required. GitHub Pages continues to build on branch commits.

Deployment confirmation requires a Pages workflow run for the exact content
commit. If GitHub coalesces rapid commits into a later build, an earlier job may
remain unconfirmed; after 24 hours it displays “deployment could not be confirmed”
instead of reporting an unrelated successful workflow. Consult GitHub's run link.

## Validation and operation

Local tests cover the real Postgres approval trigger and RLS, service-only leases,
retry/backoff, stale workers, current admin checks, fixed repo/path restrictions,
uncertain GitHub responses, concurrent commits, and separate Pages outcomes.
GitHub API tests use a simulated remote; they do not create test production commits.
The Vault/pg_net/pg_cron integration and App credentials must be verified after
the owner applies the setup and approves a genuine content change.

Useful references:
- [Supabase function authentication](https://supabase.com/docs/guides/functions/auth-headers)
- [Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- [GitHub non-forced reference updates](https://docs.github.com/en/rest/git/refs#update-a-reference)
