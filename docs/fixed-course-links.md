# Fixed course share links

## Status

English/Dutch links implemented for all four courses (eight links in each home view).
Both languages start at the lobby; Dutch links show Dutch descriptive text and
retain their language through module navigation. Local and browser checks passed.
Separate
`<bachelor>/<course>/` bundles remain a future step in `course-structure.md`.
The Workspace home now lists Share link directly below Published in map and list
views. This change does not generate course folders.

## Share links

Add `&fixed=1` to a course-specific entry URL:

- AWS I: https://aiwise-eur.github.io/AI-Wise/aiwise-c1-final.html?course=psychology.aws1&fixed=1
- Psychodiagnostics: https://aiwise-eur.github.io/AI-Wise/aiwise-c1-final.html?course=psychology.psychodiagnostics&fixed=1
- Inleiding: https://aiwise-eur.github.io/AI-Wise/aiwise-c1-final.html?course=pedagogical-sciences.inleiding&fixed=1

`lobby.html` is also a valid fixed entry. A fixed link displays the existing course
pill as a read-only name, with no Change button or course-selection modal. Chapter
links, home links and the C1 map iframe carry the same course. Opening two fixed
courses in different tabs does not change either tab or the remembered course for
ordinary links. Missing/unknown fixed IDs fail visibly and never fall back to AWS I.

AWS I retains its activity links. Other fixed courses hide the AWS-only home card
and C3 continuation, including its caption. AWS activity pages carry the fixed
context through their links and questionnaire's programmatic navigation. External
links, files, other repositories and the Workspace are not rewritten. Fixed URLs
are navigation context, not authentication: editing the URL or opening a different
public link is still possible. Examples remain shared by bachelor.

## Workspace shortcuts

`workspace/share-links.js` reads the existing course registry and builds fixed
`lobby.html` URLs on the student domain, with explicit `lang=en` and `lang=nl`.
Both home views show the course and bachelor, English/Nederlands new-tab links,
and a Copy button for each language. Copy success names the course and language; if clipboard access is
unavailable, a selected read-only URL allows manual copying. The controls write no
browser storage, content or requests. Future courses must be published before their
registry-backed share links are distributed; automatic live-status tracking is deferred.

## Implementation and rollout

- `pipelines/course-loader.js`: pinned selection precedence, no preference writes,
  read-only pill, no chooser, no fallback for invalid fixed IDs.
- `pipelines/content-language.js`: URL context propagation and AWS-only activity
  visibility. Observes newly added links for new-tab/copy-link use and also handles
  clicks. The existing language and draft-key APIs remain unchanged.
- `common/ui-effects.js`: preserves fixed context for programmatic navigation.
- Common HTML: only script query stamps changed. Catalog IDs and field schemas are
  unchanged; `orientation-schema.json` only refreshes the corresponding HTML hashes.
- `common/lobby.html` and the ten AWS activity HTML files load the same navigation
  helper. Existing effects, forms and activity content remain in place.
- Current student site: equivalent patches to Published runtime scripts and script
  tags. The legacy lobby now reads the frozen Published registry/content rather
  than the old flat course list. All shared helper dependencies are included.
- No SQL or Edge Function code changes. The existing release builder already copies
  these runtime scripts; future newly prepared releases inherit the implementation.
  Existing frozen bundles remain unchanged; prepare a fresh candidate for publishing.
  The lobby and legacy activity pages are outside the current 11-file release bundle
  and retain their compatibility script tags between releases.
- `published-content.json`, approved archives, submission rows and browser storage
  are unchanged by this work. No approvals or content publication are triggered.

## Verification

All 45 files in `sh checks/run-tests.sh` pass. Tests cover fixed course precedence,
preference preservation, all three IDs, invalid IDs, language/query/hash handling,
external URL boundaries, iframe and dynamic links, hidden AWS activities, programmatic
questionnaire parameters, and helper inclusion in every AWS activity page. The
Published bundle test runs fixed selection checks against the generated loader.
Local browser checks cover the actual student V9 content and full navigation.

Workspace shortcut verification (7 October): all 45 test files passed; a local
read-only UI fixture verified the actual map/list markup, all three copied URLs,
and the 390px mobile list without horizontal overflow. The fixture was removed
before committing. Live Workspace verification follows the Pages deployment.

## Log

- 2026-11-04 — Added English/Nederlands links for AWS I, Psychodiagnostics, Inleiding
  and DPAS Skills (eight total), in both map and list views. The owner explicitly
  chose the lobby as the first screen. Its hero and card descriptions follow
  `lang=nl`, preserving course-name slots and the existing navigation. English
  descriptions remain unchanged. `common/lobby-language.js` is mirrored to the
  current Published lobby; the lobby is outside the frozen release bundle, so its
  helper persists across releases. No approved content, release snapshot, SQL or
  Edge Function changes. Added checks for both languages, copying, unavailable
  clipboard/registry, course-slot preservation and default English.
  All 59 repository test files passed. Browser checks covered eight links per view,
  copying, the 390px list without horizontal overflow, Dutch DPAS descriptions and
  English AWS descriptions with the actual V11 course renderer. The Published
  content snapshot remains byte-identical.

- 2026-10-06 — Implemented fixed share links as requested, without changing the
  existing approval/publishing workflow or claiming that folder-based course bundles
  have been completed. Preserved V9 content and documented the remaining separation.

- 2026-10-07 — Added the requested Share link rows beneath Published on the home map
  and in list view, using the existing visual styles and the three fixed student
  home links. No separate Share links screen or data migration.
