# Control Tower item approval

## Status

| Part | Status |
| --- | --- |
| Comparison UI and guarded SQL | Implemented; local SQL and browser tests pass |
| Frontend | Included in development / Beta; capability-gated until owner SQL |
| Supabase activation | Owner pending: [setup](../supabase/CONTROL_TOWER_APPROVAL_SETUP.md) |
| Live pending requests | Read-only checked; no approvals or data edits performed |

## Target identity and merge rule

Identity is the **content scope + chapter + locale + slot ID + field path**. The
scope is the stored content scope (for example Psychology shared by AWS1 and
Psychodiagnostics), not a guessed match of course labels. Common slots such as
`c1.block-1` identify the selected Studio item; `Heading 1` or `Text 1` identifies
one field within it. Different text, or a changed title, does not change this ID.
Some course items have separate title/body slot paths, which can merge independently.
Added boxes are compared by persistent box UUID. They are atomic so their layout,
position, rich runs and text stay coherent. Order changes are a separate unit.

Compare original submission baseline, submitted content, and current Beta:
- Only the request changed a field: use the requested change.
- Only Beta changed it: keep Beta.
- Both have the same result: keep it without asking.
- Both changed it differently: require a choice. String fields also offer custom
  wording; its old rich runs are removed and the page's default typography applies.
Text and its rich formatting travel together, never old runs attached to new text.

**Existing ID-less arrays remain atomic.** In particular, the C2 examples picker
exposes individual cards, but its stored list has no stable per-card IDs. Reordering,
addition, removal and editing make positional matching unsafe. The dialog explicitly
says that its choice affects the complete list. SAT step lists are also atomic.
Achieving finer comparisons for those lists requires a separate stable-ID change;
this implementation does not migrate existing labels or pending request snapshots.

## Approval transaction and audit

The UI calls `workspace_prepare_content_approval`, then shows the comparison and
exact diff from current Beta to the proposed result. It sends only conflict
resolutions plus the preview and expected Beta baseline to
`workspace_apply_content_approval`. The server checks administrator access, request
revision, current Beta release **and content**, recomputes the merge from stored
snapshots, compares it with the preview and validates the supported content schema.
It locks the request and scope with the same ordering as existing approval/submission
operations. Dutch requests still require the matching English source release.

Original `slots`, `base_slots`, `base_release`, summary and author never change.
`approval_result` separately records the current pre-approval baseline, final slots,
chosen resolutions and `no_op`. Reviewer identity comes from the signed-in account.
A no-op decision records approval/revision normally but does not replace the Beta
submission ID or enqueue a GitHub job. Other approvals enqueue the **merged Beta
snapshot** through the existing trigger. Existing Edge Functions need no change.

Revision/reject use the old RPC. The old approval RPC keeps its chapter stale guard,
so a cached client cannot silently replace newer data. Updated clients require the
`approval_merge: 1` capability. Cancellation only closes the dialog. Concurrent Beta
changes make confirmation fail; close and reopen to see a fresh comparison.

## Verification

- `sh checks/run-tests.sh`: all tests, including disposable Postgres checks of
  out-of-order approval, same-item/different-field merging, overlap rejection,
  manual text, tamper rejection, concurrent Beta change, request revision checks,
  no-op without an outbox job, immutable snapshots, grants and repeatable setup.
- Browser/server parity cases cover lists, rich formatting, independent boxes,
  removal versus edit, ordering, optional fields and explicit choice variants.
- `workspace/tests/approval-review.browser.cjs`: real browser, isolated mocked API;
  cancel, mandatory overlap selection, manual text, exact preview/payload, safe
  rendering, mobile width, stale-Beta failure and already-reflected confirmation.
- `workspace/tests/draft-recovery.browser.cjs`: original Studio integration regression.
- Read-only snapshots of pending requests `f49dc055-81c9-49e2-8158-263841b48991`,
  `6f01e530-42e7-4a4d-b2ee-47d8a12b89a1` and
  `59f31469-f327-4d7e-a710-4eec97ace5c4` were passed through both local merge engines.
  All have zero overlaps at verification time; the middle request is already reflected.
  Actual live approval remains untested until owner activation and a deliberate review.

## Log

- 2026-10-05 — Implemented comparison-based Control Tower approval and owner setup.
  No existing pending request was changed. See the scope/list limitations above.
