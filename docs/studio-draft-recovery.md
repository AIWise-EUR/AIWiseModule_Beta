# Studio draft recovery

## Status

Implemented 2026-10-05; extended 2026-11-02 with source diagnostics and decisions
inside the recovery popup. Front-end only; no owner SQL, Edge Function deployment,
ID rewrite or content migration is required. November update is live: PR #30,
Beta `a843f88`, successful Pages run `41443414176`. The four deployed Workspace
runtime files match the locally tested source byte-for-byte.

## Problem and user flow

A saved browser draft records both its original slots and its edited slots. When
another approval replaces that chapter's Beta baseline, Studio previously showed a
generic restore warning and blocked saving. The browser draft was preserved, but
the user could only reset it or recover it manually.

Common and Content Studio now automatically open a review dialog for a stale draft
once the current preview is ready. Closing it preserves the draft; **Review saved
draft** reopens it. The dialog uses the existing Workspace theme, buttons, modal
backdrop, motion and reduced-motion preference.

1. **What happened:** the original branches into Latest Beta and Your saved draft.
   Only real changed fields/boxes are listed, with full text available for longer
   excerpts. Additions, removals, identical edits and overlapping edits are labelled.
2. **Choose a version:** each overlap requires an explicit selection. Text labels
   are **Changed in Beta**, **Changed in your draft**, and **Both versions changed
   this paragraph. Choose which wording to keep.** Non-paragraph objects use “item”.
   Nothing is selected by default. Non-overlapping changes are retained together.
   Text conflicts also offer **Write replacement text here**, with an exact preview
   and default typography. There is no need to return to the editor to compose it.
3. **Preview result:** show the chosen content for each changed item. **Apply to my
   draft** checks Beta again, validates and renders the combination, backs up the
   exact old browser record, then saves against the currently reviewed baseline.
   A completion step offers **Return to the editor** or **Send to Control Tower**.
   The latter opens the ordinary summary/confirmation dialog; it does not submit
   automatically. Closing at any earlier step leaves the stored draft unchanged.

The original warning screenshot came from a different browser. Its actual draft
was not available to this implementation. Browser test examples are isolated
fixtures, not claims about that person's changes.

## Comparison and preservation rules

- Three copies: saved `baseSlots` (plus `baseExamples` for course C2), saved edits,
  and the current approved Beta/source baseline. Equality ignores object-key order.
- Common text fields and nested object fields merge individually. Each string and
  its rich-text runs form one comparison value; old formatting is never attached to
  changed text. All rendered author content uses text nodes and allowed styles.
- Arrays, including C2 example lists and SAT phase/step lists, are chosen as whole
  lists if both sides changed them. This deliberately avoids treating reordered
  cards as the same item merely because their indices match.
- Added boxes merge by stable UUID, including deletion-vs-edit conflicts. Independent
  additions keep Beta order followed by draft-only additions at each placement.
  Reordering existing boxes becomes a separate choice if both versions differ;
  order choices never drop unrelated additions.
- Existing schema-1 records, course keys, Common IDs, boxes, server requests,
  approvals, archives and student releases are not rewritten.
- Backups use unique `<draft-key>:recovery-backup:<uuid>` browser keys. The recovered
  record's optional `recoveryBackup` points to its backup, so **Download original
  draft backup** remains available after reload and later saves. Earlier backups
  remain stored. Downloads can also be taken before applying.
- Storage is checked against the exact original before and after backup creation.
  Backup failure stops replacement. Another tab's changed draft stops recovery.
  No direct writes to pending requests or remote content occur in this feature.
- A newly changed Beta during review stops apply and asks for a reload. The normal
  server submission/approval baseline guard remains unchanged. Dutch recovery keeps
  the old English-review marker so recovery cannot certify a translation as reviewed.

## Limits and recovery failures

The source comparison ignores only the `v` cache query on the known language,
Beta, Common and course loaders. Other queries, script paths and source changes
remain meaningful. This covers the October 7 `content-language.js` cache change,
which the earlier comparison mistakenly treated as a layout change.

Actual Common markup changes are diagnosed from both inert page catalogs. The
popup lists changed item names, slot IDs, before/after source fields and the first
source-line difference. Identical blocks with matching ancestor locations retain
ordinary three-way review. Changed locations never reuse old positional text or
boxes automatically: edited fields require the current Beta choice or explicit
replacement wording for a current string field. Removed locations can be left
out of the working draft, with their old content retained in the backup. Unedited
fields simply retain current Beta. No cross-slot remapping is inferred.

Malformed records, missing originals, wrong chapter/language or unsupported data
show the specific failing identity/data location. The popup offers an explicit
choice to leave the original untouched or preview a fresh current-Beta draft.
The latter backs up the exact original before saving and clearly states that old
edits are in the backup, not in the new working draft. It never forces invalid old
data through the renderer. Both Beta content and Common source HTML are rechecked
before recovery; backup failure or another tab's edits stop replacement.

If a selected combination violates the current schema (for example an old removed
field) or cannot render its box placement, apply stops and preserves the original.
The user can change the selection to current Beta or download for manual recovery.
This does not bypass the stale-approval policy for already submitted requests.

## Implementation and checks

- `workspace/draft-recovery.js`: pure comparison/combination, backup write protocol,
  safe content presentation and the three-step review dialog.
- `workspace/draft-recovery.css`: responsive theme-based dialog styling.
- `workspace/content-studio.js`: stale-draft detection, review integration, preview
  validation, current-baseline check, backup export and normal save/submission path.
- `workspace/tests/draft-recovery.test.cjs`: independent/overlapping/same edits,
  formatting, box additions/deletions/order, atomic lists, optional fields, unsafe
  keys, quota failures, stale tabs and safe popup rendering.
- `workspace/tests/draft-recovery.browser.cjs`: isolated Chromium integration using
  the actual Common and Content Studio code and module iframe, mocked Beta reads,
  mobile overflow checks, backup/reload, submission metadata, a newly advanced Beta,
  another tab changing the draft, and malformed data. No real account is used.
- `sh checks/run-tests.sh`: full repository regression suite before deployment.

Verified on 2026-10-05: all repository test files passed, all 11 focused recovery
tests passed, and the isolated Chrome browser integration passed for both studios,
including the 390px layout. Production deployment is checked separately after push.

## Log

- 2026-10-05: Replaced the unexplained stale-draft block with actual three-way review,
  explicit conflict choices and recoverable local application. No database changes.
- 2026-11-02: Added the known language-loader cache exception, exact source/location
  diagnostics, guarded decisions for changed locations, replacement wording in the
  popup, backed-up restart choices, and post-save editor/submission options. The
  original reported browser draft was not supplied; fixtures reproduce the actual
  cache change and changed-location cases, not a claim of recovering Neus's draft.
  Verification: all 47 files in `checks/run-tests.sh` passed under Deno 2.9.6
  (CommonJS compatibility flags; JavaScript runtime tests without type checking).
  Fifteen focused recovery tests and the real Studio/iframe browser fixture passed,
  including 390px layout, manual wording, completion actions, malformed-file backup,
  current Beta races and cross-tab preservation. No live-account test writes.


## 2026-11-09 · Storage-full recovery and work export

Deployed to Beta at `1a3a6c59f187849b57e3511f976e021582a038f1`; Pages run `42561031191` succeeded. The live standalone archive page was verified. This change is local-browser
storage only. No SQL, Edge Function, approved content or online request changes.

- `draft-storage.js` stores new pre-merge/pre-layout backups in IndexedDB. Immutable
  backup IDs retain their original keys. Write transactions must complete and exact
  raw text must read back before a draft can be replaced.
- Existing localStorage backups move only on an explicit Archive action. The exact
  key allowlist covers Common C1/C2/C3/map and bachelor chapters in EN/NL. Current
  drafts, settings and other application data are excluded. Each original is removed
  only after verified archive commit and an immediate source equality check.
- Archive labels include scope, chapter, language, original draft savedAt, archivedAt,
  reason, original key, estimated text size and current-draft reference. Legacy backup
  creation times/reasons are unknown; the original draft timestamp is not substituted.
- Storage-full errors offer Archive backups and retry. Save retries use the live
  in-memory edits; recovery retries preserve review selections and rerun baseline
  checks. Repeated attempts reuse the same backup identity. Inputs/navigation are
  guarded while saving; exports remain available. Failure never resets a draft.
- Export current work downloads versioned JSON without writing browser storage. It
  includes current rich-text values, baseline, source HTML, prior saved raw record,
  pending recovery record and review choices, item position and submission summary.
  The export is unapproved data; external tools must compare/validate and use the
  normal submission/approval flow. It contains no credentials. This release supplies
  export and archive preview/download, not an automatic file importer or publisher.
- Existing original-backup downloads search both stores. `backup-storage.html` lists,
  filters, previews and downloads archives and moves old backups on explicit click.

### Rollout preserving already-open unsaved editors

Open `workspace/backup-storage.html` in a **new tab in the same browser/profile**.
Keep the old editor open without reloading. Archive backups in the new tab, then
retry Save draft / Apply to my draft in the old tab. Only after the old work is saved
(or separately copied/exported) should that editor be refreshed to load the new UI.
Old tabs can still create localStorage backups; another archive pass can move them.
A deployment cannot reach or export unsaved memory in an already-loaded old client.
If archiving fails, keep that tab open and manually copy unsaved text before reload.

### Limits

IndexedDB is still browser/device-local and can be unavailable, full or cleared by
site-data removal. If the active drafts themselves fill localStorage, moving backups
may not resolve the error. Export remains the fallback. No automatic permanent
archive deletion is introduced. Tests use isolated synthetic data, not Neus's actual
browser contents. Remote submission is not automatically retried by this feature.


### Validation

- All 62 repository test files pass, including 13 new archive/export tests.
- Actual Studio save/export functions tested across 20 scope/chapter/language
  combinations (Common C1/C2/C3/map and three bachelors C2/C3, EN/NL).
- Native browser localStorage quota reproduced on an isolated localhost origin.
  Actual archive and Studio save functions moved 128 synthetic backups, retried
  successfully and preserved unsaved Unicode text. Downloaded work JSON was read
  back and checked against the unsaved editor text and original raw draft.
- Actual recovery popup retained replacement text through a quota error and a
  single Archive backups and retry action; native IndexedDB original verified.
- Separate archive tab moved backups while the original editor tab retained later
  unsaved input; saving in that original tab succeeded without reloading.
- Failure tests cover rejected archive writes, verification mismatches, interrupted
  migration/resume, changed source/current drafts, identity conflicts, unavailable
  capacity, unchanged unrelated settings and readable labels/old backup references.
- Native fixtures were cleaned. No real browser drafts or online records were
  edited in these tests; Neus's browser contents remain uninspected.


## 2026-11-09 C2 box placement recovery

Status: validated and prepared for Beta rollout.

A supplied DPAS C2 Dutch work export reproduced a valid saved draft with five
authored boxes and a valid latest Beta with six blank boxes. The old comparison
treated different UUIDs as independent additions, producing eleven boxes and
failing the placement-uniqueness validator at apply. The private export is not
committed.

New C2 text-box additions are paired only when their explicit family and example
placement match uniquely and neither placement/identity existed in the saved
baseline. The combined copy keeps the Beta identity. With identical layout, a
fully blank counterpart yields to authored rich text. Different authored content
or layout requires an explicit choice. Existing IDs/deletion conflicts and
unrelated families/placements retain their previous behavior. Originals remain
unchanged; the usual backup-before-save and server baseline checks still apply.
Box comparison titles now identify the example number.

Validation: all 62 repository test files passed under Deno 2.9.6 (no-check,
CommonJS detection and bare Node builtins enabled for npm-installed test dependencies).
Native-browser verification was unavailable because the Chromium download failed.
Five regression tests cover the five-plus-six case, rich text,
conflicting wording, layout changes, identical additions, independent placements,
and deletion-versus-edit. The supplied export also passed the actual comparison,
combination, copy validation, recovered layout-plan initialization and payload
checks: six boxes, all five authored boxes preserved, no layout payload required.
The other-language review marker correctly remains stale.

Rollout: reload Workspace in the original browser/profile, reopen DPAS C2 Dutch
and apply the reviewed recovery. Deployment alone cannot write another browser's
localStorage. No approved content, pending submission, SQL or Edge Function is
changed by this patch.

Log: 2026-11-09 — reproduced the user's exported failure; implemented placement
matching and verified preservation without committing private authored content.
