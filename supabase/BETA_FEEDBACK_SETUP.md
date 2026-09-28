# Beta preview feedback rollout

Status (29 September 2026): code and local tests complete; the user confirmed applying the SQL directly. Frontend deployment is proceeding separately. Live account sharing and database advisors have not been independently verified by this task.

1. In project `cvcvdiohckwgpgoxibia`, ensure the existing workspace membership and shared Studio migrations are installed. This migration reuses `workspace_role()`; it does not alter that function or assign roles.
2. Run the entire `migrations/20260928151827_beta_review_feedback.sql` once in SQL Editor. Do not rerun earlier migrations. The transaction adds only the Beta memo/reply tables and their supporting validation, indexes, permissions and private triggers.
3. Run the following read-only check. Expect two rows with `rowsecurity = true`.

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('workspace_beta_memos', 'workspace_beta_replies')
order by tablename;
```

4. Inspect the new objects in the Supabase advisors. The trigger-only `aiwise_private.beta_feedback_stamp()` uses an empty search path, rejects callers without active membership, derives authors from `auth.uid()`, and has no direct browser execute/schema grants. The public anchor validator is an immutable SECURITY INVOKER function. No public read policy exists for feedback. Live advisors were not run by this task because database access is being handled directly by the user.
5. Deploy the matching frontend after SQL application. With authorized team accounts, post a deliberate real comment, refresh from a second account, reply, then resolve/reopen as the author or an administrator. A normal teammate must not resolve another author's thread. A signed-out or revoked account must not read or add feedback. Do not publish dummy review comments without intending to keep them.

The new tables grant authenticated users SELECT, INSERT only on user-supplied columns, and UPDATE of `resolved` only. RLS additionally requires active team membership for every read/write and author/admin ownership for resolution. Author IDs/names, timestamps and resolution stamps cannot be supplied or changed by clients. No DELETE or text-edit operation is exposed. Feedback does not change module content, approval status, or Published. The existing static preview remains public.

The displayed module is current Beta, not a stored screenshot or historical release. Each annotation includes a content fingerprint and its original excerpt; changed source text yields an unavailable-location message instead of moving a mark to different content. Box/pin coordinates are relative to the selected content box. Nested diagrams can be selected from the Content box picker; their internal canvases are not rewritten.

Local verification used pinned `@electric-sql/pglite@0.3.14` and `linkedom@0.18.12`:

```
PGLITE_MODULE=/path/to/@electric-sql/pglite node supabase/tests/beta_feedback.cjs
LINKEDOM_MODULE=/path/to/linkedom node --test workspace/tests/beta-review.test.cjs
```

The SQL tests execute migrations against an isolated PostgreSQL engine and assert access for anonymous, nonmember, member, author, admin and revoked identities. UI tests used an isolated local feedback fixture; no live comments were created. These do not substitute for the real-account check above.
