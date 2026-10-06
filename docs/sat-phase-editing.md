# S.A.T phase boxes

## Status

Implemented and tested; SQL and `aiwise-release` activation remain owner-applied
in Dashboard. Frontend structural controls are capability-gated. Empty-cycle
hiding is independent and can ship immediately to Beta and current Published.

## Behavior and compatibility

- A box means one Self–AI or Self–Team cycle, containing four steps. Steps retain
  their existing actor, name and text fields; the S.A.T title and note stay separate.
- A phase whose four step bodies contain only whitespace is omitted by the module
  renderer. Its saved data is retained. Editor cards explicitly label empty phases
  and can be expanded for typing; filling any body makes the phase visible again.
- Add Self–AI / Add Self–Team at the top appends a blank cycle; the same buttons in
  each card insert immediately after that card. Delete removes only that cycle from
  the draft, with Undo/Redo. Zero to fifty phases are allowed; users can add back
  after deleting all. The existing design, save and review entry points are reused.
- Formats follow surviving phase objects when indices shift; deleted phase formats
  are removed. Rendering scopes each format to its original phase/step index so
  repeated wording and hidden phases cannot redirect styling to a different box.
- Existing `c2.sat_example` slot, draft keys, submitter and release identities stay
  unchanged. Control Tower still reviews the S.A.T example as **one existing item**;
  this is finer editing UI, not a new merge identity or approval bypass.
- No source content, pending requests, approved archives, browser drafts or frozen
  Published JSON are rewritten. All other variable/fixed array rules stay unchanged.

## Implementation

- `pipelines/course-loader.js`: hide empty phases, retain original phase/step indices.
- `pipelines/common-content.js`: targeted SAT format rendering and shape validation.
- `workspace/studio-editing.js`: collapsible cycle cards, add/delete, format reindex,
  Undo/Redo and `sat_phases` capability gate; `content-studio.js` attaches that editor.
- `supabase/SAT_PHASE_EDITING_SETUP.sql`: 0–50 valid cycles with exactly four steps,
  bounded strings, allowlisted actors/keys; replaces validators without data writes.
- `supabase/functions/aiwise-release/index.ts`: matching freeze-time validation.
  GitHub-Publish already preserves the approved nested payload without fixed-length
  checks, so it needs no deployment.
- Script cache stamps and schema HTML hashes updated; original field IDs unchanged.
- Current student runtime receives only the renderer/format targeting hotfix. Its
  existing Published V9 JSON and release identity remain unchanged.

## Verification

- Full repository test runner: 47 files pass.
- New frontend regressions cover non-destructive hiding, non-contiguous phase
  indices, repeated wording, exact rich-text targeting, shape boundaries,
  add/delete, Undo/Redo and blocked-draft refusal.
- Disposable database covers unchanged pre-existing pending requests and sources,
  legacy approval, authenticated add/delete/zero/add-back approval, invalid payloads
  and repeat-safe activation. No live test submissions are created.
- Release tests freeze 0/2/4 phases and reject malformed steps.
- Local real Studio/iframe fixture with explicitly mocked backend capability:
  delete 3→2, Undo→3, add Team→4, edit text, Save, reload restores four boxes and
  text; test-only Send for review receives all four. Fixture removed before commit.

## Log

- 2026-10-07 — Implemented the owner's request to hide the blank Psychology final
  cycle and edit S.A.T boxes individually. Owner Dashboard activation is documented
  in [setup](../supabase/SAT_PHASE_EDITING_SETUP.md); no live backend/data mutation.
