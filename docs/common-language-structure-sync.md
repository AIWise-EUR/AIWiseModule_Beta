# Common language structure sync

Working record for the November 4, 2026 request from Seyoon. English and Dutch must
share the page layout, while existing Dutch translations and drafts remain intact.

## Status

| Work | State |
|---|---|
| Common Studio projection and Dutch added-box editor | Implemented on `fix/common-language-structure-sync` |
| Beta and frozen release rendering | Implemented; uses English from the same reader/version |
| Unit, real Studio browser and existing PostgreSQL approval contracts | Verified locally; full repository gate recorded below |
| Production deployment | Owner action; not deployed by Codex |
| New SQL or Edge Function deployment for this change | None |
| Editing access only follow-up | Implemented; no translation text or saved-field identity changes |

## Confirmed behavior

- The source HTML is already shared between languages. Studio-added boxes are now
  projected from **approved English**, never an English browser draft or a pending
  request. English controls box IDs, template, parent block, anchor, order, alignment
  and box text size. Dutch controls the text and its existing rich-text runs.
- Stable box UUIDs retain translations when a box moves or changes its layout.
  A new box starts with approved English wording and explicit **Translation needed**
  labels. Dutch editors can edit its fields, but cannot independently add/delete/move
  boxes. This avoids another divergence.
- An incompatible template/field count is not positionally translated. The original
  Dutch box is retained in the draft's retired history; the new shape starts in
  English and requires translation review.
- English wording changes do not overwrite Dutch. A locally saved English reference
  identifies changed fields and marks them **Translation review needed**. If the
  older reference is unavailable, the application conservatively requests review
  of the text instead of guessing which translation is current.
- Review buttons support individual fields and the whole chapter (**Mark chapter
  translation reviewed**). Chapter review explicitly acknowledges all remaining
  fields; it does not translate English starting text. Save and submission are separate. Submission is
  blocked while translation review is outstanding or the English source has not
  been acknowledged. The existing server source-release guard still refuses an
  approval if English changed again after submission.
- Opening a draft never writes to storage. Saving a synchronized copy first backs
  up the exact original local JSON. A deleted box disappears from the current layout,
  but its translated fields remain in `translationSync.retired`, and previously
  submitted/approved copies remain in the existing immutable server history.
- The true Dutch server baseline stays in `baseSlots`; projecting a preview does not
  invent a new approved baseline. Submitted copies therefore pass the existing
  comparison, conflict and approval flow without an SQL migration.
- Shared Common content shown inside Course Studio follows the same layout rule.
- Standalone Beta and Published pages project their Dutch display using English
  returned by their existing reader. Saved review versions and Published therefore
  use their own frozen English, without fetching current/live English. New English
  text in a Dutch page has a visible translation notice. If Dutch is not approved,
  the approved English copy (including its added boxes) is displayed as a labelled
  fallback. No translated copy is silently approved or published.

## Preservation and boundaries

The optional `translationSync` metadata lives in local draft JSON, not in the
approved slots schema. It records the English comparison copy, pending field IDs
and retired box copies. The ordinary submission snapshot remains unchanged in
shape. The original local draft backup is available through **Download original
draft backup**. Clearing browser storage also clears local-only backups; already submitted
translations remain in server history.

This fixes the Studio-added-box divergence. Original HTML containers continue to
use the existing shared HTML and catalog. An incompatible code-level HTML/catalog
change still opens the existing detailed recovery workflow; this patch does not
silently map positional block IDs to different content. Word-level rich formatting
is not copied across different-language character offsets.

This does not claim to fix every earlier translation feedback item. The system map,
SAT diagram labels, navigation labels and course-owned Markdown/XML slots need
separate checks of their editing scope. DPAS activation and the earlier owner
Supabase setup are independent and are not included in this branch.

## Owner rollout

1. Review and merge this branch into `development` when ready to deploy. Do not
   replace any Supabase function for this patch; there is no new SQL installer.
2. Wait for the Beta Pages deployment. Open Common Studio in Dutch and reload the
   page once. Existing drafts should reopen with their translations; new shared
   boxes are marked for translation. The initial open must not rewrite a draft.
3. Translate/review marked fields, save, acknowledge the English source when asked,
   and send to Control Tower. Review and approve as usual. Old pending requests
   remain unchanged; those referencing an older English approval need revision.
4. Prepare a **new** review/release version to ship the updated renderer to students.
   Existing frozen release candidates keep their original implementation. Do not
   expect this branch to retroactively change previously published files.

## Verification

- `workspace/tests/common-language-sync.test.cjs`: additions, moves/order/layout,
  Dutch runs, deletions/return, incompatible templates, per-field review persistence,
  real C1/C2/C3 approved boxes, safe rendering, reader-specific frozen English and
  missing-Dutch fallback.
- `workspace/tests/common-language-sync.browser.cjs`: actual Studio UI with isolated
  fixtures; original JSON untouched on open, editing added Dutch boxes, review gates,
  save/reload, English source change, deleted translations, backups and mobile fit.
- `supabase/tests/common_language_sync.cjs`: full ordered migration chain in local
  PostgreSQL (PGlite); English approval, Dutch submit/approve, stale English refusal,
  repeated sync and immutable original translation/request history.
- `sh checks/run-tests.sh`: full gate required before pushing.

These are local integration checks, not proof of a signed-in production approval.
No live drafts, pending requests, approvals, releases or database rows were changed.

## Log

- **2026-11-04 editing access only** Per Seyoon's revised scope, added direct
  editing actions for navigation labels, shared SAT diagram labels, inherited
  boxes and Course Studio Markdown/XML examples. Existing catalog paths remain
  unchanged. Assistant C1–C3 browser translation drafts were reset. MAP translations
  from request `690d9e72-3ec7-4033-a35e-0114eb25027f` were reverted through
  Control Tower request `125998fc-c4e1-4dff-8f35-2b7953242cae` (Applied to Beta).
  Neus's pending requests and student Published content were not modified.
  Regression coverage verifies shared-symbol routing and course-slot preservation.
  All 53 repository test files passed, including 9 Common Studio scenarios.

- **2026-11-04** Implemented approved-English box projection, Dutch box text editing,
  field review, non-destructive draft backups/retired translations, public/frozen
  rendering and course preview integration. Deployment remains with the owner.

- **2026-11-04 verification** All 52 repository test files passed. The Common
  language sync unit file contains 9 passing scenarios. The real Studio browser
  check passed, including Course Studio context and avoiding duplicate full-draft
  backups on ordinary saves. No live-service write or deployment was performed.
