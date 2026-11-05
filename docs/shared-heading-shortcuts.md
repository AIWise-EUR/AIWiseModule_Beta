# Shared heading editor entry points

Requested 2026-11-05: open the C2 example headings directly from their displayed
location, and audit other editable fields without a nearby entry point.

## Status

| Work | State |
|---|---|
| C2 shared heading buttons in Common and bachelor Studio | Implemented and browser verified |
| Same-language route to the exact shared input | Verified for Dutch DPAS and Common |
| Common shared-label entry outside desktop navigation | Implemented for C1/C2/C3; map annotation entry retained |
| Coverage audit | Completed; remaining indirect entries listed below |
| Validation | All 61 repository test files passed; isolated browser save/reload and keyboard checks passed |
| Beta deployment | Live at 8acb7bd; Pages run 42010495394 succeeded; real Common and DPAS paths verified |

## Behavior

Each rendered C2 thinking/typing/processing heading has an **Edit shared heading**
button. Common Studio opens and focuses its existing field. Bachelor Studio opens
`#common/c2/labels/<key>` without changing the language query parameter. Existing
unsaved-edit and draft-recovery guards remain in force. The shared editor explains
that changes apply to every course/example in this chapter in the selected language.

The existing hidden shared-copy block and field IDs remain unchanged. There are no
new authored fields, database migrations, source-content edits, approval changes,
or student publications. Common C1/C2/C3 also have a visible **Edit shared headings
& labels** entry outside the desktop navigation. The older navigation-only entry
was absent in the live rendered preview; the new entry is attached after rendering
and is recreated if removed.

## Audit results

Reviewed the source catalogs (C1 36, C2 63, C3 103, map 41 items), runtime copied
labels and Common/bachelor editor targeting. Direct browser checks covered C1,
C2, C3 and map previews, DPAS C2 and the Common C3 template links.

Remaining fields without a button beside their displayed instance:

- C3 **Adopt / Modify / Discard** labels and C2 S.A.T **Self / AI / Team** badges.
  These are common wording, distinct from the editable example descriptions and
  step names. The new chapter-level shared-label button opens their existing fields.
- Other common interface copy, including **Example / of**, **Copy / Copied**, course
  selection and feedback wording. Some widgets are intentionally absent in the
  isolated editor preview. Their common fields use the same chapter-level entry.
- Browser tab titles for C1/C2/C3/map have no in-page visual target. They remain in
  the item picker under **Interface & supporting content** (field **Page title 1**).

Existing direct paths confirmed: C2 S.A.T small-diagram labels, C3 Markdown/XML
course example links, and all 22 map node targets plus map annotation editing.
The C2 worked-example wrapper can be hidden when the selected course has no
configured slot; this is conditional content rather than a missing text field.

## Log

- 2026-11-05: Added heading-local buttons, exact-field Common routes, shared scope
  explanation and a visible shared-label entry. Real isolated Studio checks verified
  all three fields, keyboard activation, Dutch save/reload, DPAS-to-Common locale
  retention and protection of unsaved example edits. Existing content/field
  identities stay intact. All 61 test files passed after allowing the test runner's
  required local listener; the first restricted run failed only on listener access.

- 2026-11-05: Deployed 8acb7bd to Beta. Pages run 42010495394 succeeded. In the live Dutch editor, the heading button opened Thinking 1; the DPAS heading button opened the same editable Common field while retaining Nederlands. No live wording was changed or saved.
