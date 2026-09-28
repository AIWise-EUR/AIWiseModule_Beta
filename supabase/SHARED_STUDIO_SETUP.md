# Shared Content Studio rollout

Status: implementation and local database/browser tests are prepared. Live database application, first administrator selection, frontend deployment, and two-real-account verification must be completed before calling this live.

## Apply in order

1. Confirm the existing project is `cvcvdiohckwgpgoxibia` and the membership migration `202609270001_workspace_members.sql` is already installed.
2. Run the complete `migrations/202609280001_shared_studio.sql` in that project's SQL Editor as the project administrator. It is one transaction and installs three tables, RLS policies and guarded RPCs. Run once. It does not upload browser drafts or requests, approve content, change Auth users, or assign an administrator automatically.
3. In Table Editor → `workspace_members`, locate the intended administrator by the User UID from Authentication → Users. Set that existing row's `role` to `admin` and keep `active=true`. Leave other approved users as `member`. Do not guess an account or promote every member. Subsequent role delegation/revocation is performed in the same dashboard table; an in-app role-management UI is not included.
4. Verify the migration and one administrator exist. Deploy the matching frontend changes to the Beta repository's `development` branch, preserving any newer design changes. Do not deploy these frontend files before the migration: Studio and Beta deliberately report errors when approved content cannot be loaded.
5. With two real approved accounts, save and submit a deliberate test edit as a member, open it in Control Tower as an administrator, and approve it. The approved edit is public on Beta after reload. Use real content you intend to publish to Beta; do not approve dummy test text on the live project. Verify an ordinary member cannot approve. Published is a separate repository and remains unchanged.

If the Supabase connection is available, the same additive migration can be applied through it. No service-role key, database password or user password belongs in frontend code or chat.

## Data and permission boundaries

- Working drafts remain in the existing browser keys. Send to Control Tower is the explicit upload action; it sends the full saved chapter plus its baseline and summary.
- `workspace_submissions` stores immutable content copies, author UID/name, summary and review decision. Active members can read all submissions; no browser role can insert/update/delete directly. The submit RPC derives author identity from `auth.uid()` and validates content against the approved baseline. User-editable Auth metadata never grants permissions.
- `workspace_members.role` defaults to `member`. Only active `admin` members can use the decision RPC. The browser hiding a button is not the security boundary. Role checks occur in Postgres for every operation.
- `workspace_beta_content` exposes only the approved course/chapter slots, submission ID and timestamp to public readers, consistent with the existing public GitHub Pages Beta. Pending content, author data and review comments are not public. Browser roles cannot write this table.
- Approval, request status and the active Beta chapter change atomically. Row locks and a course/chapter transaction lock serialize competing decisions. A stale base release cannot replace a newer approved version. Saved client IDs prevent duplicate submission on retry.
- C2 and C3 for AWS1 and PED are connected. Common Studio, course registration, teacher profiles, Beta comments, and Published release deployment are outside this increment. These records are not automatically uploaded.
- Old local requests remain labeled Browser only; their local decisions cannot affect Beta. Shared requests show Team and use the account identity. Refresh requests retrieves current server records. Open Beta pages update on reload, not by realtime push.
- If repository slot structures change later, update the server's supported source/approved schema as part of that release. This migration seeds the current four chapter baselines and intentionally rejects incompatible content.

## Verification

The local tests use PGlite's actual PostgreSQL engine with an Auth schema fixture; they never touch the live Supabase project. The browser test uses the pinned real Supabase SDK against intercepted requests backed by that database, with independent member/admin browser contexts and a public Beta reader.

```
PGLITE_MODULE=/path/to/@electric-sql/pglite node supabase/tests/shared_studio.cjs
NODE_PATH=/path/to/node_modules PGLITE_MODULE=/path/to/@electric-sql/pglite SUPABASE_TEST_SDK=/path/to/supabase.js CHROMIUM_PATH=/path/to/chromium node workspace/tests/shared-studio.browser.cjs
```

Database coverage: anonymous/nonmember reads and writes, forged user metadata roles, denied direct writes even for admin accounts, immutable copies, retry deduplication, all four source schemas, stale reviews/releases, atomic application and revoked access. Browser coverage: member save/submit, failed network retry, second-account review, admin approval, public Beta content, safe text rendering, latest Studio baseline, stale local draft preservation, sign-out cleanup and visible Beta load errors. Existing course and all-slot editor tests remain available.

These checks do not replace applying the migration and verifying real account sessions against the live Data API.

Implementation references: https://supabase.com/docs/guides/database/functions and https://supabase.com/docs/guides/database/postgres/row-level-security.
