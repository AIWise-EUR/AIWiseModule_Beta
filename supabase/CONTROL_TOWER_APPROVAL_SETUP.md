# Activate item-by-item Control Tower approval

Owner action: open the **AI_Wise** Supabase project → **SQL Editor** → **New query**.
Copy the entire `CONTROL_TOWER_APPROVAL_SETUP.sql`, then Run once. This setup file is
byte-identical to migration `20261005141841_control_tower_item_approval.sql`.
No Edge Function replacement or redeployment is required.

Prerequisites: course scope, Studio blocks and Psychology SAT setup already applied.
The script runs in one transaction and is safe to re-run. It adds nullable approval
metadata and guarded RPCs. It does not rewrite existing submitted payloads, authors,
statuses, revisions, source labels, current Beta content or publishing jobs.

After Run, refresh Workspace. Open a pending request in Control Tower, enter the
review reason and click **Approve & apply to Beta**. This now opens a comparison;
nothing is approved until the final confirmation in that dialog.

1. Compare the original request with latest Beta. Independent changes combine.
2. For overlaps, keep Beta, use the request, or write custom wording for text fields.
3. Review exactly what will change and confirm. An already-reflected result records
   the approval without changing Beta or creating another deployment.

The original request remains visible under **Original submitted request**. The
approved result is displayed separately. Publishing to students remains separate.

Until this SQL is activated the updated UI shows a setup message on approval. It
never falls back to overwriting an old chapter. Revision/rejection still work, and
existing requests remain available. Cached old UIs retain the old guarded RPC.

Validation after owner activation:
- `select public.workspace_studio_capabilities();` returns `approval_merge: 1`.
- Run the read-only command in `checks/live-check.ts`'s header.
- Signed in as an administrator, open the three known pending requests, inspect
  their comparison, then cancel. Do not approve them just to test activation.
- Use normal deliberate approval for a real decision, then verify Beta and the
  ordinary GitHub processing status. A no-op approval correctly has no new job.

Identity and limits: see `docs/control-tower-item-approval.md`. C2 example lists have
no stable per-card IDs, so both-side list changes require a whole-list choice; no
position-based guessing. This matches Studio recovery. Added boxes use their UUIDs.
