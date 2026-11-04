# Bidirectional language layouts and DPAS editing

Requested 2026-11-05: preserve existing translations, synchronize structure in both
directions, and make every DPAS C2/C3 example editable.

## Status

| Work | State |
|---|---|
| English/Dutch structural projection and approval preview | Implemented |
| Original wording, rich formatting and conflict protection | Tested in JS and temporary PostgreSQL |
| DPAS empty fields, SAT controls, AMD selections | Implemented; real Studio browser verification |
| Backend activation | Owner deployment pending; setup below |
| Frontend deployment | All 61 test files passed; ready for gated Beta deployment |

## Decisions

English supplies the initial added-box order; boxes unique to either language are
retained. Editing either language can then change box placement/order/style and
example/SAT membership. Approval applies that structure to both copies in one
transaction. Wording and rich-text runs stay owned by their language.

Existing box IDs remain unchanged. Variable example/SAT arrays keep origin mappings
in draft/submission metadata, including Undo/Redo and duplication. No new IDs or
schema fields are injected into authored course slots. New opposite-language fields
are empty. Before/after copies preserve removed wording in approval history.

Layout-only counterparts have separate linked audit records attributed to the actual
reviewer. Provisional Dutch copies are editable but not counted as completed
translations in public reads or newly prepared releases. An explicit language
approval clears that status. No existing published release or authored content is
changed on installation.

DPAS had blank C2/C3 templates in both catalogs. Blank inline critique fields had
no usable click area; Dutch could not add initial SAT phases; blank AMD tags lacked
their selector. Empty fields now have visible editor targets and clear input hints,
Dutch shares structural controls after capability activation, and AMD offers its
three valid choices even when initially blank. SAT visual kind follows actor roles
instead of depending only on an English phase title.

## Rollout

Follow [the backend setup](../supabase/BIDIRECTIONAL_LAYOUT_SETUP.md): deploy
GitHub-Publish first, then SQL. Frontend structure tools are capability-gated.
The older [Common-only record](common-language-structure-sync.md) describes the
previous English-to-Dutch projection; this change supersedes that directionality
when the new capability is active. Frozen student releases remain unchanged.

## Log

- 2026-11-05: Implemented projection, saved draft metadata, two-language approval,
  provisional-language handling and DPAS editing fixes. Initial full repository
  tests passed; expanded recovery, Common and approval tests added before final gate.
- 2026-11-05: Final repository gate passed all 61 test files. In the isolated real
  Studio browser fixture, Dutch C2 text and SAT additions saved; all 14 C3 items
  exposed editable inputs and saved, including empty critique, AMD selectors,
  Markdown, XML and the full example. Reload restored saved wording. Live DPAS still
  has no submissions or approvals, and the new backend capability is not yet active.
