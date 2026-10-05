# Empty Psychology S.A.T example

The owner requested a blank input box with the same structure and design as PED.
Psychology previously had only `c2.examples`; its two S.A.T slots were absent.
The source now includes the placeholder title "S.A.T worked example", three PED phases (Self–AI, Self–Team,
Self–AI), the same twelve actor/step labels, empty narratives and an empty note.
No pedagogical-sciences example prose is copied. The existing S.A.T renderer and
Content Studio field editor provide the design and editing controls.

## Owner activation

1. Wait for the development Pages deployment to succeed.
2. In the existing Supabase project's SQL Editor, run all of
   `PSYCHOLOGY_SAT_SETUP.sql`. No Edge Function redeployment is needed.
3. Reload Workspace, open Content Studio → Psychology → C2, and choose
   **S.A.T worked example** in the Self–AI–Team group. The title, twelve step
   narratives and note are editable. Save and submit through the usual user account.

The SQL adds only the missing SAT source fields for Psychology C2. Both language
source rows receive the empty shape so the Dutch editor remains structurally valid;
this is not authored Dutch content. Existing examples, pending/approved submissions,
approved Beta content, versions, prepared releases and student pages are unchanged.
There is no completed example to publish. The Beta source can display the empty
Worked example scaffold once deployed; author content still requires normal review.

The transaction stops without changes if a Psychology C2 pending or approved copy
appeared before first activation. Do not remove that safeguard: inspect the new copy
and extend compatibility first. Re-running after activation preserves authored data.
Older browser drafts without SAT slots are extended in memory only when the new SAT
baseline is wholly empty. Existing examples/boxes remain intact; save once to submit.

## Verification

`workspace/tests/psychology-sat.test.cjs` checks PED structure parity and saved-draft
preservation. `supabase/tests/psychology_sat.cjs` runs in a disposable database and
checks unchanged pending rows/examples, both language shapes, actual authenticated
submission/approval, rerun preservation, and the concurrent-request guard.

Live owner SQL and the subsequent real-account blank-template submission remain
pending. The three Common Studio box requests have already been submitted separately.
