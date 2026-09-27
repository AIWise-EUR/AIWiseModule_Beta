# AI-Wise development-team sign in

This first step adds email/password sign in, sign out, session restoration, and a database-backed development-team membership check. It does not migrate local drafts, requests, courses, or teacher profiles. The static prototype remains accessible without login. Membership is not yet attached to shared content operations, because those operations are not implemented.

## One-time administrator setup

1. In the Supabase project SQL Editor, run `migrations/202609270001_workspace_members.sql`. It creates one table and a policy that lets signed-in users read only their own active membership. They cannot insert, update, or delete membership rows.
2. In Authentication → URL Configuration, use `https://aiwise-eur.github.io/AIWiseModule_Beta/workspace/` as the Site URL. This release uses direct password sign in and does not implement email-link, password-recovery, or OAuth callbacks.
3. For the first test, create **your own workspace user** under Authentication → Users → Add user → Create new user, using your email and a password you keep privately. Confirm the user through the dashboard's confirmation option. A Supabase dashboard account is not automatically an application user. No invitation email is required by this flow.
4. Copy that Auth user's ID. In Table Editor → `workspace_members`, insert a row with that UUID in `user_id` and `active = true`. Leave `created_at` at its default. This enrollment is an administrator action; never grant browser users permission to insert themselves.
5. Disable public account signup in Authentication settings while the app is limited to administrator-created development-team accounts. Even if signup remains enabled, an account must have a separate active membership row to pass the team check.

Use only the public URL and publishable key in browser configuration. Keep database passwords and administrative keys out of the repository. Do not send user passwords through chat.

## Test in the website

Open `/workspace/`, expand the sidebar, and select **Sign in** at the bottom. Enter the workspace user's credentials. A valid active member sees **Your development-team membership is verified.** Sign out and sign in again; refresh the page to test session restoration. The same account dialog is available in Course Profiler.

The dialog distinguishes failed credentials, a signed-in account without membership, missing membership setup, and a network/access-check failure. None of these failure states counts as verified membership. Check again repeats the server check. Disabling a membership row causes the next check or return to the page to remove the verified state.

Sign out ends this browser's session, including its synchronized tabs. It does not clear pre-existing local prototype drafts or records. The local Control Tower name is still an unverified prototype identity; login is not retroactively assigned to historical request authors.

## Implementation

- `workspace/supabase-config.js`: public connection settings.
- `workspace/supabase-connection.js`: pinned Supabase SDK loader and shared client.
- `workspace/auth.js`: Auth events and server-verified user/membership state. Async work is deferred out of SDK Auth callbacks to avoid lock deadlocks.
- `workspace/auth-ui.js` and `workspace/auth.css`: accessible account dialog with existing motion timings.
- `workspace_members`: membership administration stays in Supabase for this first release. Roles such as reviewer and release manager are not assigned by this table.

The browser membership indicator is UX only, not a security boundary. Every future shared table/function must enforce membership and operation-specific permissions in Postgres. RLS must also protect immutable submitted versions and prevent client-side approval or role escalation.

## Validation boundary

Automated browser tests exercise the real Supabase SDK against controlled Auth and Data API responses, including rejected users and network failures. No real account is created by the test. SQL policy tests in `tests/workspace_members.sql` passed in local PGlite/Postgres with a minimal Auth schema fixture, including self-only reads, denied browser writes, nonmembers, anonymous access, and revocation. They can also be run against a disposable Supabase test database. Do not treat mocked browser responses or a local Auth fixture as a substitute for running the migration and testing two real accounts. Live end-to-end sign in remains pending administrator setup.
