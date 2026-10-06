# Bachelor – course structure

Working record for moving AI-Wise from a flat course list (`aws1`, `ped`, `other`) to
courses identified by **bachelor and course**, each with its own student URL.

This file is the handoff point between people and agents (Claude, Codex). Read
[Status](#status) first, update it when a step changes state, and add a line to the
[Log](#log) at the end of every working session.

## Decisions

Agreed with the project owner (Seyoon) between 2 and 4 October 2026.

1. **One repository, one Publish.** The existing all-courses student site stays. Each
   course also gets its own folder and URL in the same `AI-Wise` repository. A single
   Publish updates every URL in one commit, so Common content can never differ between
   courses. Separate repositories per course were rejected for that reason.
2. **Identity is (bachelor, course).** Every course belongs to one bachelor. The study
   year is part of the course name, not a level of its own. The same course name under
   two bachelors is two separate entries; nothing is shared between them automatically.
3. **Three content layers, one direction of inheritance.**

   | Layer | Applies to | Holds |
   |---|---|---|
   | Common | every course | C1 and shared copy |
   | Bachelor default | every course of that bachelor | orientation examples (C2, C3) |
   | Course | that course only | optional overrides of the examples; activity pages; preset prompts |

   A course without its own examples shows the bachelor default. Activity pages are
   always owned by the course and are never inherited.
4. **Restructure now.** `aws1` and `ped` are not kept as course IDs. Their examples
   become the bachelor defaults of Psychology and Pedagogical Sciences. Only a handful
   of approvals exist today, so this is the cheapest moment.
5. **"Other courses" is removed.** It has no place in a bachelor – course list.
6. **Separation, not access control.** A course URL pins its course and carries only
   that course's content, so students do not wander into another course. Someone who
   knows another URL can still open it; there is no login.
7. **Share links.** Updated by the owner on 7 October: show the current fixed student
   links directly below Published on the first Workspace map, with a Copy button per
   course. List/mobile view provides the same links. Course names open the student
   home in a new tab; the bachelor appears below each name. A separate page and
   publication-status tracking for future courses are deferred.
8. **Claude implements; Codex continues from this record.** Do not work on the same
   step from two agents at once.

### Courses at the start

| Bachelor | Course | Examples | Activities | URL path |
|---|---|---|---|---|
| Psychology | B1 – Academic Writing Skills I | Psychology default | yes (today's AWS I pages) | `psychology/aws1/` |
| Psychology | B1 – Psychodiagnostics | Psychology default | none yet | `psychology/psychodiagnostics/` |
| Pedagogical Sciences | B1 – 1.1 Inleiding in opvoeding en onderwijs | Pedagogical Sciences default | none yet | `pedagogical-sciences/inleiding/` |

URL paths are final once a link has been given to students.

9. **Earlier versions stay as saved.** V1–V5, prepared releases and finished commit
   jobs keep the ids they were frozen with (`aws1`, `ped`, `other`). When a newer cycle
   is compared with them, those ids are read as today's, so the rename is not a change.

## How it is built

- **Registry: `common/courses/registry.json`.** The single list of bachelors and
  courses. Module pages, the workspace and the release builder all read this file.
  A course is addressed as `<bachelor>.<course>` (`psychology.aws1`); its URL path is
  `<bachelor>/<course>/`. `aliases` map the earlier ids to today's: on a course, for
  links and remembered choices (`?course=aws1`); on a bachelor, for the scope ids
  inside saved versions.
- **Content scope.** Approved content is stored per scope: `common` or a bachelor id.
  The `course` column of the content tables holds the scope. Every course of a
  bachelor is rendered from that bachelor's rows and its content file.
- **Database: `workspace_content_scopes`.** Lists the valid scopes. The database knows
  bachelors, not courses, so adding a course to an existing bachelor is a registry edit
  with no SQL. The bachelors in this table and in the registry must match;
  `supabase/tests/content_scopes.cjs` and `checks/live-check.ts` both compare them.
- **Workspace.** `workspace/course-registry.js` exposes the registry as
  `window.AIWiseCourseRegistry` (`courses()`, `bachelors()`, `scope()`, `scopeName()`,
  `previewCourse()`). Content Studio is opened per bachelor (`#studio/psychology`).

## Open questions

- **Course overrides (layer 3) are not built.** The registry and the database can
  describe them later (a third scope kind), but today every course shows its
  bachelor's examples unchanged. No course needs an override yet. Proposed when one
  does: per slot, merged over the bachelor default.
- **Browser tests are stale.** The five `workspace/tests/*.browser.cjs` files still use
  `aws1`/`ped` routes and were neither updated nor run: they need Playwright and
  Chromium, which the machine this was written on does not have. Update them on a
  machine that can run them.
- **Module pages are cached for up to ten minutes.** Their `course-loader.js` URL
  was not version-bumped, because that changes the page hash recorded in
  `pipelines/orientation-schema.json`. A stale copy falls back to default examples
  until the cache expires.

## Where the course list is fixed today

Checked against `development` at `e0a9c49`. These are the places that must read the
registry instead of a literal list.

**Database**

- `workspace_content_sources.course` check constraint and the paired chapter check
  (`20260930062634_orientation_content_languages.sql`). `workspace_submissions` and
  `workspace_beta_content` reference this table by `(course, chapter, locale)`.
- `workspace_beta_memos.page` check: the allowed `?course=` values are in a regular
  expression in the same migration.
- Review inbox: `20261001164531_review_inbox.sql`, line 26.
- Tables that store a course value without a constraint: `workspace_github_jobs`,
  `workspace_beta_checks`, `aiwise_private.beta_draft_checks`, and the `content` JSON of
  `workspace_beta_versions` and `workspace_releases`.

**Workspace**

- `beta-review.js` (three lists), `control-tower.js`, `tutorials.js`
- Display names: `beta-checklist.js`, `beta-item-details.js`, `beta-update-list.js`,
  `shared-studio.js`, plus literal names in `workspace.js`, `courses.js`,
  `content-studio.js`, `overview.js`
- `courses.js` reads `common/courses/index.json` and keeps added courses in
  `localStorage` only. It is not a shared registry.

**Module pages and loaders**

- `pipelines/course-loader.js`: file path per course in `fetchCourse`, the `extends`
  merge, and the course chooser. `data-force-course` on `<html>` already pins a course.
- `pipelines/beta-content.js` and `pipelines/published-content.js`: allowed course list.
- `common/courses/index.json`, `common/courses/other.json`,
  `course-specific/aws1/course-specific-content_aws1.json`, `course-specific/ped/ped.json`

**Edge Functions**

- `supabase/functions/aiwise-release/index.ts`: required content keys, the three course
  files, and a fixed set of eleven flat destination files. The matching allowlist is in
  `workspace_store_release_candidate` (`20261001083839_publish_based_versions.sql`).
- `supabase/functions/github-publish/index.ts`: allowed course list and the
  `content/approved/<locale>/<course>/<chapter>.json` path.

## Plan

Steps 1–3 ship together. In between, the workspace and the database would disagree
about which courses exist.

| # | Step | Owner action in Supabase |
|---|---|---|
| 1 | **Registry.** `common/courses/registry.json` with the three courses above. | none |
| 2 | **Content scopes.** `aws1` → `psychology`, `ped` → `pedagogical-sciences`; retire `other`; replace the fixed checks with a scopes table. | run SQL |
| 3 | **Workspace, loaders, functions.** Studio, Control Tower, Beta, the module loader and both Edge Functions read the registry. | redeploy `GitHub-Publish` and `aiwise-release` |
| 4 | **Per-course publishing.** The release contains the all-courses site plus one folder per course with a pinned course and only that course's content. Widen the release file allowlist. | run SQL, redeploy `aiwise-release` |
| 5 | **Share links page.** | none |
| 6 | **Activities.** Move the AWS I activity pages into `psychology/aws1/`. | none |
| 7 | **Course overrides**, when a course first needs its own examples. | run SQL |

Every step that changes SQL or an Edge Function needs a setup note in `supabase/` in
the style of the existing `*_SETUP.md` files, because only the owner can apply it.

## Status

| # | Step | State | Notes |
|---|---|---|---|
| 1 | Registry | on `development` | |
| 2 | Content scopes | live | SQL applied by the owner on 2026-10-04 |
| 3 | Workspace, loaders, functions | live | signed-in screens and the two redeployed functions still need a first real use; see Log |
| 4 | Per-course publishing | fixed share links implemented; folder bundles pending | `?course=<bachelor.course>&fixed=1`; no SQL/function changes for this stage |
| 5 | Share links | implemented on Workspace home | Below Published in map and list views; fixed student home links with Copy; no separate page |
| 6 | Activities | not started | |
| 7 | Course overrides | not started | not needed yet |
| 8 | Published ID compatibility | live; browser verified | [Hotfix and full-transition plan](published-course-compat.md) |
| 9 | Studio block editing | live; cross-chapter box fix verified | [Compatibility and rollout](studio-block-editing.md); original IDs unchanged |
| 10 | Psychology SAT empty template | source prepared; owner SQL pending | [Setup](../supabase/PSYCHOLOGY_SAT_SETUP.md); existing requests remain unchanged |
| 11 | Studio draft recovery | live; browser verified | [Visual comparison and backups](studio-draft-recovery.md); no SQL or function changes |
| 12 | Control Tower item approval | live; signed-in previews verified | [Comparison rules and rollout](control-tower-item-approval.md) |
| 14 | S.A.T per-cycle editing | live; activation verified | Empty cycles hidden; per-box Add/Delete; [record](sat-phase-editing.md) |

## How to verify

- `sh checks/run-tests.sh` runs the tests under Deno (47 files).
  Run it before every push.
- `deno run --allow-read=. --allow-net=cvcvdiohckwgpgoxibia.supabase.co,api.github.com,aiwise-eur.github.io,raw.githubusercontent.com checks/live-check.ts`
  checks the live setup without credentials or writes. Run it after the owner applies
  SQL or redeploys a function.
- Tests in `workspace/tests/` and `supabase/tests/` were written with the features and
  run under Node as well. Extend them for new behaviour; do not rewrite them for Deno.
- Neither covers what only the live project shows: deployed function names, real rows,
  Supabase safeguards. After each owner action, confirm in the workspace as well.

## Log

- 2026-10-06 — Added fixed-course share links for the three registered courses.
  `fixed=1` pins the explicit course without writing browser preferences; the
  existing course pill becomes a read-only name and no chooser is created.
  Fixed context follows chapters, home, system-map iframe, late-added links and
  programmatic questionnaire navigation. Non-AWS fixed courses hide AWS activities;
  ordinary unfixed links retain the chooser. All 45 test files passed; local browser
  checks covered Psychodiagnostics C1 → C2 → C3 → home → reload and AWS activity
  navigation. This is URL-scoped navigation, not per-course content bundles or an
  access-control boundary. Student V9 content and existing drafts/submissions stay
  unchanged; no owner Dashboard step is required. See `fixed-course-links.md`.

- 2026-10-06 — Diagnosed Neus preview/load failure using actual approved data. A
  Psychology C2 box was being rendered on C1/C3. Restricted course box rendering
  to chapters present in the document; all 44 test files and browser draft recovery
  passed. Existing drafts, submissions and V9 content retained. See the incident
  entry in `studio-block-editing.md`; Control Tower cancelled-run status is separate.

- 2026-10-05 — Owner activated item approval. All seven live checks passed. Three
  real signed-in pending requests reached comparison and final preview successfully;
  each was cancelled without recording a decision. See `control-tower-item-approval.md`.

- 2026-10-05 — Added Control Tower three-way approval with field/box comparisons,
  explicit conflict choices or custom text, exact final preview, immutable submitted
  snapshots and separate approval audit. No-op approvals keep the current Beta release
  and create no publishing job. SQL activation belongs to the owner; no Edge Function
  change. Three actual stuck requests were checked read-only and remain pending.
  See `control-tower-item-approval.md` for the ID-less list limitation and tests.


- 2026-10-05 — Added real three-way comparison of saved browser drafts and current
  Beta in Common and Content Studio. Visual explanation, explicit overlap choices,
  original backups, baseline recheck and ordinary submission flow; existing pending
  requests are untouched. See `studio-draft-recovery.md` for recovery rules and tests.

- 2026-10-05 — Owner activated Studio block editing. Live functions matched supplied
  source; the seven live checks passed. Real authenticated Common Studio requests
  successfully reached Control Tower as Team/Awaiting approval (C1 responsibility,
  C2 choice notice plus earlier intersubjective box, C3 closing dialogue box).
  Existing requests were retained. Same-chapter requests retain the stale-approval
  guard; the C2 combined request explicitly identifies the earlier request it includes.
- 2026-10-05 — Added empty Psychology S.A.T source fields using PED's exact three
  phase/twelve-step structure and existing renderer. No example prose copied. Added
  guarded, repeatable owner SQL, old-browser-draft compatibility and tests. Only the
  owner SQL and real blank-template submission remain pending; no Edge Function
  change is required. See `supabase/PSYCHOLOGY_SAT_SETUP.md`.

- **2026-10-05** (Codex) Added isolated Beta/Published preferences and exact legacy
  course aliases. Full tests pass, including generated Published loader scenarios.
  See [Published compatibility record](published-course-compat.md) for the current
  V5 hotfix and the later ID-transition plan. No SQL or Edge Function change.

- **2026-10-04** (Claude) Recorded the decisions and the plan. No code changed.
- **2026-10-04** (Claude) Built steps 1–3 on `claude/course-structure`. The owner chose
  to keep V1–V5 as saved (decision 9) and to drop "Other courses". All tests pass under
  Deno. Seen working in a real browser against the unchanged live database: module
  pages for all three courses and for the earlier ids, the course chooser, Course
  Profiler, and Content Studio for both bachelors and for Common (opened without
  signing in, by calling its render function). Not seen: anything behind sign-in
  (Control Tower, Beta review, submissions, approvals) and everything after the SQL
  change, which only the owner can apply. Verify those on the Beta site right after
  rollout.
- **2026-10-04** (Claude) Merged `claude/course-structure` into `development` at the owner's request. Owner steps pending: the SQL script, then redeploy `GitHub-Publish` and `aiwise-release`.
- **2026-10-04** (Claude) The owner ran the SQL script and redeployed both functions. `checks/live-check.ts` passes all seven checks: scopes match the registry and the approved PED chapter is served under `pedagogical-sciences`. Seen on the Beta site: `?course=ped` opens Pedagogical Sciences – Inleiding with the approved examples. Still to confirm by use: signed-in workspace screens, the next approval's automatic commit (new `GitHub-Publish` code) and the next release preparation (new `aiwise-release` code).
- **2026-10-05** (Claude) Sidebar: the Courses section lists bachelors; choosing one opens its courses in the second column, beside the row (inline on narrow screens). Seen in a browser at desktop and phone width.
- **2026-10-05** (Claude) Sidebar: every expandable row (Course Profiler Manager, Content Studio, Beta, each bachelor) now opens a floating list sized to its items beside that row, replacing the full-height second column.

- **2026-10-05** (Codex) Published hotfix `32aad6d` and Beta compatibility source
  `6e159dd` deployed successfully. Verified new/legacy IDs, unavailable-course chooser,
  and Beta → Published return without preference collision. Content V5 and pending
  approvals were not changed. Full ID transition remains a separate planned task.

- **2026-10-05** (Codex) Integrated English box/card additions and text formatting into
  Studio using an optional extension. No source label rewrite or pending-row migration.
  See [Studio editing record](studio-block-editing.md) for tests and owner activation.

- **2026-10-07** (Codex) Added Share link under Published on the Workspace home map
  and list views. Uses registry course names and fixed student lobby URLs, with
  per-course Copy feedback and a manual-copy fallback. No content, drafts, pending
  requests, database or publishing workflow changes. See `fixed-course-links.md`.

- **2026-10-07** (Codex) S.A.T cycles now hide when all four step bodies are empty.
  English Content Studio has collapsible per-cycle editors and Add/Delete with Undo.
  Variable cycle counts preserve old snapshots and format paths. Validation-only SQL
  and one `aiwise-release` Dashboard deployment enable structural authoring; no data
  migration or change to Control Tower item identity. See `sat-phase-editing.md`.

- **2026-10-07** (Codex) Owner activated S.A.T Add/Delete. Capability, deployed
  function, phase-count validation, all seven live checks and enabled signed-in
  editor controls verified. See `sat-phase-editing.md`; existing browser draft
  review remains a separate step and no saved draft was changed.
