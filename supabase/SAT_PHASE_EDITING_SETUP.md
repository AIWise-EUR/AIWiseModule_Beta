# Activate S.A.T box Add / Delete

The owner applies these two steps in Dashboard, as previously requested.

1. Replace the existing **aiwise-release** function with the complete contents of
   `functions/aiwise-release/index.ts` and deploy. Keep its existing configuration
   and secrets. **GitHub-Publish does not need replacement for this change.**
2. Run all of `SAT_PHASE_EDITING_SETUP.sql` in SQL Editor. Apply this after the
   function deployment. It replaces validators and reports `sat_phases: 1` from
   the existing capability RPC. It changes no saved content or submission rows.
3. Reload Workspace. Open Content Studio → Psychology → C2 → S.A.T worked example
   → Edit item. Each Self–AI / Self–Team box has Add and Delete; Edit this box opens
   its four steps. Blank boxes stay available here but are hidden in the module.

Read-only verification:

```sql
select public.workspace_studio_capabilities();
-- Expected: {"blocks":1,"sat_phases":1}
```

Saving still creates a browser draft. Send to Control Tower and approval are still
required for content changes to reach Beta; publication remains separate. Do not
use an older, already-prepared release candidate for new variable-length S.A.T
content: prepare a new candidate after approval.

Until activation, the new per-box text editors work but Add/Delete stay disabled.
Empty-cycle hiding works independently of this activation. No reset of drafts or
resubmission of existing pending requests is needed.
