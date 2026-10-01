# AI-Wise development-team sign in

Workspace supports email/password registration, confirmation-email resend, sign in, sign out, session restoration, and a database-backed development-team membership check. Account creation and team approval are separate steps. It does not migrate local drafts, requests, courses, or teacher profiles. The static prototype remains accessible without login. For shared Content Studio submissions and administrator approval to Beta, follow [SHARED_STUDIO_SETUP.md](SHARED_STUDIO_SETUP.md) after this sign-in foundation.

## One-time administrator setup

1. In the Supabase project SQL Editor, run `migrations/202609270001_workspace_members.sql`. It creates one table and a policy that lets signed-in users read only their own active membership. They cannot insert, update, or delete membership rows.
2. In Authentication → URL Configuration, keep `https://aiwise-eur.github.io/AIWiseModule_Beta/workspace/` as the Site URL. Add the exact URL `https://aiwise-eur.github.io/AIWiseModule_Beta/workspace/auth-confirm.html` to Redirect URLs. The same callback is used from Course Profiler. Keep the signup email template's `{{ .ConfirmationURL }}` link.
3. Enable email/password signup (Allow new users to sign up) and keep Confirm email enabled. This replaces the earlier administrator-created-accounts-only setup. No account receives team membership automatically.
4. Configure custom SMTP before accepting registrations from other users. Supabase's built-in sender only delivers to Supabase organization team addresses and has strict rate limits. These are Supabase dashboard team addresses, not `workspace_members`. Do not add people as dashboard administrators just to deliver email. Keep email verification enabled. See https://supabase.com/docs/guides/auth/auth-smtp.
5. Users open Workspace → Sign in → Create account, enter email/password/password confirmation, and follow the email link. Supabase verifies the email, then redirects to `auth-confirm.html`. This page removes callback credentials from the address bar and asks the user to sign in with their password; it does not import a URL session or silently replace an existing signed-in account. Expired/invalid links offer sign in or resend. A generic confirmation page message is not proof of identity: successful Auth sign in and the server membership check are required.
6. An administrator reviews the confirmed account in Authentication → Users. To approve, copy its User UID and insert it into Table Editor → `workspace_members` with `active = true` (or reactivate its existing row). Approval stays in the Supabase dashboard for this increment: there is no Workspace approval queue or automatic administrator notification. Do not grant clients permission to insert/update memberships. The applicant reopens the account window or returns to the tab after approval; the membership check runs automatically.

No new SQL migration is required if `workspace_members` and its existing RLS policy have already been installed. This change does not grant administrator privileges or introduce self-enrollment.

Use only the public URL and publishable key in browser configuration. Keep database passwords and administrative keys out of the repository. Do not send user passwords through chat.

## Test in the website

Open `/workspace/`, expand the sidebar, and select **Sign in** at the bottom. Enter the workspace user's credentials. A valid active member sees **Your development-team membership is verified.** Sign out and sign in again; refresh the page to test session restoration. The same account dialog is available in Course Profiler.

The dialog distinguishes failed credentials, a signed-in account without membership, missing membership setup, and a network/access-check failure. None of these failure states counts as verified membership. Retry appears only when an account/access check fails. Failed sign-in attempts show Retry on the sign-in form and a separate “Don’t have an account yet?” / Create account prompt. Disabling a membership row causes the next check or return to the page to remove the verified state.

Sign out ends this browser's session, including its synchronized tabs. It does not clear pre-existing local prototype drafts or records. The local Control Tower name is still an unverified prototype identity; login is not retroactively assigned to historical request authors.

## Implementation

- `workspace/supabase-config.js`: public connection settings.
- `workspace/supabase-connection.js`: pinned Supabase SDK loader and shared client.
- `workspace/auth.js`: Auth events and server-verified user/membership state. Async work is deferred out of SDK Auth callbacks to avoid lock deadlocks.
- `workspace/auth-ui.js` and `workspace/auth.css`: sign in/create account modes, password confirmation, neutral confirmation notices, resend cooldown, and existing motion timings.
- `workspace/auth-confirm.html` and `workspace/auth-confirm.js`: dedicated email-confirmation return page; no third-party resources or automatic token import.
- `workspace_members`: membership administration stays in Supabase for this first release. The shared Studio migration adds member/admin roles; see its separate setup guide.

The browser membership indicator is UX only, not a security boundary. Every future shared table/function must enforce membership and operation-specific permissions in Postgres. RLS must also protect immutable submitted versions and prevent client-side approval or role escalation.

## Validation boundary

Automated browser tests exercise the real Supabase SDK against controlled Auth and Data API responses, including rejected users and network failures. No real account is created by the test. SQL policy tests in `tests/workspace_members.sql` passed in local PGlite/Postgres with a minimal Auth schema fixture, including self-only reads, denied browser writes, nonmembers, anonymous access, and revocation. They can also be run against a disposable Supabase test database. Do not treat mocked browser responses or a local Auth fixture as a substitute for running the migration and testing two real accounts. Live end-to-end sign in remains pending administrator setup.

## Signup browser regression checks

`workspace/tests/signup.browser.cjs` runs the real pinned Supabase SDK against intercepted HTTP responses. It never creates a live account or sends email. With Playwright installed, set `CHROMIUM_PATH` to a Chromium executable and `SUPABASE_TEST_SDK` to the downloaded `@supabase/supabase-js@2.117.2/dist/umd/supabase.js` file, then run `node workspace/tests/signup.browser.cjs`. Tests cover password mismatch, duplicate-submit prevention, signup without membership, session restoration, later membership approval, sign out preserving local drafts, signup errors, mobile/Course Profiler layout, and callback URL cleanup. Real email delivery and administrator setup must still be verified on the project.


## Account display names

Signup collects a required 1–50 character display name. Existing accounts can set or change it in the sidebar account dialog. The name is stored as Supabase Auth `user_metadata.display_name` through authenticated `auth.updateUser({data: ...})`; no new table or migration is required. Login continues to use email. Names are display labels, not unique usernames, and duplicate names are allowed. The sidebar and home greeting use the saved name after server-verified sign-in or session restore; accounts with no name show Account until they set one.

Only display metadata is sent by this form. It never writes membership, roles or application metadata. Membership checks continue to use the immutable authenticated user ID and the `workspace_members` table. Name updates are shown as saved only after Auth confirms the updated user. The verified Auth snapshot exposes the same value as `user.displayName` and `user.name` for shared UI consumers. Other signed-in sessions obtain the name when account state is refreshed or the account dialog is reopened. Existing Control Tower browser-local profile names and historical records are not rewritten.


## Approved-content GitHub commits

Studio approvals can now enqueue automatic content commits to `AIWiseModule_Beta/development`.
Control Tower shows commit and Pages deployment status separately. Enable the server queue,
worker and recovery schedule following [GITHUB_PUBLISHING_SETUP.md](GITHUB_PUBLISHING_SETUP.md).
The existing connection-check function alone does not enable publishing.
The separate `AI-Wise/main` student release path is not changed by this setup.

For separately approved **Beta → student Published** releases, follow [PUBLISHED_RELEASES_SETUP.md](PUBLISHED_RELEASES_SETUP.md). This is independent of Studio → Beta automatic commits.


### Workspace page feedback and review checklist

Run `WORKSPACE_FEEDBACK_REVIEW_SETUP.sql` once in SQL Editor after the existing Beta versions and Published release migrations. It creates the shared administrator feedback inbox and the version-specific review checklist, with active membership checks, RLS, derived author names, retry protection and optimistic updates. Existing saved versions are retained. No new secret, Edge Function, cron or Verify JWT setting is required. This file mirrors migration `20261001075603_workspace_feedback_review_flow.sql`; use one copy only.

Check the Feedback bubble with a member account, then inspect and reply from an administrator account. A member must see only their own page messages. In Beta, select a saved version, inspect a change and mark it reviewed; another teammate should see the reviewer name after refreshing. Publish this version carries the same version into the existing prepare/approve/deploy workflow. Review progress is advisory and approval remains administrator-only.

Local verification: `PGLITE_MODULE=/path/to/@electric-sql/pglite node supabase/tests/workspace_feedback_review.cjs`. This creates a disposable database and verifies inbox privacy, authoritative identity, replies, RLS, retries, version/language comparisons, concurrency and revocation. It does not apply SQL to the live project.


## Publish-based version cycles (replaces manual review snapshots)

Apply `PUBLISH_BASED_VERSIONS_SETUP.sql` once in Supabase SQL Editor after `WORKSPACE_FEEDBACK_REVIEW_SETUP.sql`. It is identical to migration `20261001083839_publish_based_versions.sql`; run one copy, not both. It preserves every existing snapshot, version number, memo and reply. Do not rerun earlier setup files afterward.

Then replace the existing **aiwise-release** Edge Function's `index.ts` with `functions/aiwise-release/index.ts` and deploy it. Keep its current Verify JWT setting (OFF); the function still verifies browser JWTs and administrator membership itself, and workers use the separate secret. No new credentials, cron or changes to the github-publish Beta worker are needed. Deploy this Workspace frontend only after both updates. The old preparation endpoint is intentionally disabled by the migration, so the old worker fails safely during the brief rollout window.

Studio approval still updates the latest approved content and queues the existing Beta GitHub commit. Beta now defaults to **Next release**. Its comparison baseline is the most recently frozen publication, not a manually saved review snapshot. English and approved Dutch content accumulate together. Changing an item invalidates its review check; unchanged comparisons keep their checks. A preview reads one fixed approved copy, and stale previews cannot mark a different copy reviewed.

**Prepare next release** builds a candidate from the exact reviewed content fingerprint. It creates no Beta version and performs no GitHub write. A fresh Studio approval makes that candidate stale. **Publish to students** locks the approval boundary, rechecks the candidate, creates the next immutable numbered version, dates it in UTC (`V2 · 2026-10-01`), and queues the existing release worker atomically. The same transaction moves the cycle's memos and matching checks into that version. Replies stay attached. Earlier manual snapshots remain labelled as earlier review snapshots, and their numbers are never reused.

New approvals then accumulate in the next cycle. A version being queued, committed and deployed are separate states; numbering is final on Publish approval, not on Pages deployment. Retrying a failed release keeps its version number. Another final Publish is blocked while a release is queued or processing. If the target GitHub branch changed, prepare again against the new branch head; that new final Publish creates a new version and retains the failed attempt in history.

Validation: `publish_cycles.cjs` applies the full migration chain to disposable PostgreSQL and tests numbering, dates, stale preparation/approval, unchanged-item checks, copied memos, permissions, worker manifests and next-cycle isolation. `beta_versions.cjs` and `published_releases.cjs` retain historical migration-contract coverage before this migration. UI and worker suites also cover the new fingerprint contract. No test needs production data or a real student publication.
## Team invitation links

Run `WORKSPACE_TEAM_INVITATIONS_SETUP.sql` once in the existing project's SQL Editor. It is an exact copy of migration `20261001090535_workspace_team_invitations.sql`; apply one of these, not both. Existing workspace membership and team-access migrations must already be installed. No Edge Function deployment or Auth setting change is required.

Administrators can create, copy and revoke links in Team management. Choose Member (Beta preview and feedback) or Administrator, eligibility (one email, an exact email domain, or any confirmed email), expiry (1, 7 or 30 days) and usage limit (1–50). Administrator invitations require one specified email and one use. Creating an invitation preapproves its stated access. Recipients still sign up, confirm their email, sign in and explicitly accept the invitation. Paused accounts require manual restoration and cannot bypass that restriction using a link.

Links contain a random secret in the URL fragment. Only its SHA-256 hash is stored in the private database; the full link can be copied during the current Team management visit. After leaving, create a new link if another copy is needed. Share links manually; this feature does not send invitation emails. Expiration, revocation, recipient eligibility, usage limits and the issuer's current administrator access are checked on the server. Revoking a link does not remove already accepted memberships. Membership changes use the existing audit log and serialized lock order.

Validation: `supabase/tests/team_invitations.cjs` runs the full migration chain against a disposable Postgres-compatible database and exercises authorization, eligibility, expiry, revocation, idempotency and role preservation. Workspace tests use mocked responses; they do not invite real users.
