# Content fit and six DPAS examples

Requested 2026-11-05: keep long text visible, make every course's C2 Part C have six
examples, and defer further example-specific added-box changes.

## Status

| Work | State |
|---|---|
| C1/C2 expanded reading cards | Unbounded content height; actual Dutch 427px body fits |
| C3 tables, panels and mobile step tabs | Wrapping and bounded columns implemented |
| SAT loop nodes | Width measured from translated labels; shared text nodes unchanged |
| Studio Open in Beta | Explicit course, fixed=1 and locale; preview course identified |
| DPAS EN/NL six examples | Live: EN/NL each six; existing content verified unchanged |
| Deployment | 61 test files passed; desktop/mobile browser checks passed; ready for Beta |

## Evidence and preservation

Psychology and Pedagogical Sciences have six example source entries in both
languages. DPAS began with one blank example in both languages. The latest Dutch
DPAS approval also has authored SAT text: that content is retained. No Psychology
examples are copied into DPAS. The five added DPAS examples are empty authoring slots.

Control Tower request `1f21e766-bf81-4850-a0fc-1af374b7e4c9` was submitted and
approved as the signed-in owner, Seyoon. Its review showed only five added entries,
zero merge conflicts and the matching English structure projection. This uses the
normal audited approval flow, without SQL/schema or Edge Function changes.

Content-fit styles are generated during the existing common renderer's sync, so
page source changes are only recognized loader cache-version changes. Existing
saved draft source comparisons and translation field identities remain compatible.
SAT adjusts rect/text positions and connecting lines without replacing text nodes.
The source schema update changes HTML fingerprints only, not the editable catalog.

The unpinned Common Studio Beta link could open a remembered different course.
All Studio Beta links now pin the exact preview course and preserve language.
The Workspace also identifies which course provides its contextual examples.

Student publication remains the separate reviewed Publish to students action.

## Log

- 2026-11-05: Live data compared, DPAS expansion approved, and frontend regression
  tests added for SAT translation identity and pinned language/course links.

- Live approval verification: DPAS EN and NL each contain six examples. Comparing
  the Dutch approved result with the request baseline confirms the first example
  and every non-example slot are unchanged. Historical installation seeds remain
  unchanged; the six-item layout belongs to the audited approved content.

- Browser verification: all ten Dutch C2 comparison bodies fit their content; the
  longest measured body grows to 427px. At 390px, C3 page width is 390px and both
  tables fit at 350px; no overflow in the measured active panels/templates.
  SAT labels fit widened, equal-size nodes without reducing the small-loop text.

- Fixed a reproduced post-approval draft recovery failure: when both copies already
  agree on the new list and no structural draft changes remain, recovery now uses
  the matching current peer baseline. Pending structural intent and ambiguous
  list changes still require review. Original draft and language wording remain.
