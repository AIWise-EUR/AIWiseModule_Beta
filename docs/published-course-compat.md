# Published course ID compatibility

## Status

| Item | State |
|---|---|
| Root cause reproduced | Confirmed: legacy Published rejects a remembered `psychology.aws1` |
| Current Published hotfix | Validated locally; deployment verification recorded below |
| Future release source | Updated `pipelines/course-loader.js`; generated-bundle regression passes |
| Full ID transition | Planned, not part of this hotfix |

## Root cause and scope

Beta and Published share origin `https://aiwise-eur.github.io`, despite using different
repository paths. Both used localStorage `aiwise-course`. Beta now stores qualified
course IDs; the V5 Published snapshot still contains `aws1`, `ped`, `other`. Its
course lookup threw `Unknown course`, which the loader displayed as a generic
Published-content failure. A reload reused the incompatible ID. Page and JSON
release IDs matched; pending approvals were unrelated.

The fix does not approve pending content, rename any historical records, or replace
the currently published content snapshot. The local block-editing sample is separate.

## Fix

- Storage: Beta uses `aiwise-beta-course`; Published uses `aiwise-published-course`.
- Read old `aiwise-course` only if the site-specific value is absent. Never write or
  delete it. Save a canonical value only after matching a manifest entry.
- Prefer exact IDs and manifest-declared aliases. For legacy Published only, support
  the exact pairs `psychology.aws1` → `aws1` and
  `pedagogical-sciences.inleiding` → `ped`, only when the destination exists.
- Do NOT map `psychology.psychodiagnostics` to AWS I, or map arbitrary bachelor
  prefixes. Unsupported Published courses show a specific notice and the existing
  course chooser; no wrong-course content is loaded and a prior valid choice survives.
- Pinned pages never change preferences or offer a chooser. Storage denial does not
  prevent URL/default loading. Actual network/release errors remain visible.
- Current hotfix: update only `published-course-loader.js` and its script URL in
  C1/C2/C3 (`&compat=20261005`), so a cached script cannot keep the old behavior.
  The map does not load the course loader. Content JSON and release IDs stay unchanged.
- Future releases: `pipelines/course-loader.js` detects `window.AIWisePublished`
  for its storage namespace. The existing release builder preserves the resolver
  while replacing source fetches with frozen-file fetches. No Edge Function or SQL
  implementation was changed; no dashboard rollout is required for this patch.

## Validation

- Full `sh checks/run-tests.sh` passed on 2026-10-05.
- `workspace/tests/course-loader.test.cjs`: 7 Beta/registry tests including legacy
  import and independent namespace precedence.
- `workspace/tests/published-compat-harness.cjs`: legacy/new aliases, URL precedence,
  old preference preservation, namespaced preference precedence, unsupported course
  chooser, no silent prefix mapping, pinned selections, unavailable storage, and
  real network failures. Applied to the actual patched V5 loader before deployment.
- `supabase/tests/published_bundle.test.mjs` runs the same harness on the actual
  generated next-release loader (modern manifest and bachelor content reads).
- Browser local check: actual V5 C1 + `?course=psychology.aws1` renders correctly.

## Deployment and rollback

Current live base: AI-Wise `main` at `049e15ff03fcdf707eeca969cb484a4b2d670bab`.
Beta base: AIWiseModule_Beta `development` at
`f3b330f092b7f8dcf0c621af3c37860bb44e3fc7`.
The compatibility patch is kept in separate checkouts from other active work.
Pushes are non-forced so a concurrent commit stops deployment for reconciliation.
Revert the specific hotfix commit to roll back runtime/HTML changes; do not restore
an entire old content snapshot. Existing namespace values are harmless if rolled back.
Already prepared releases may contain older runtime files: prepare a fresh release
from the corrected source before the next Publish. Do not publish an old prepared
bundle over the fix without checking its runtime.

## Full ID transition plan

1. Inventory three different identities separately: content scope (bachelor), course
   route (`bachelor.course`), and immutable release/version identity. Labels shown to
   users are not identifiers. Keep the registry authoritative.
2. Confirm explicit old/new mappings. `aws1` ↔ `psychology.aws1`,
   `ped` ↔ `pedagogical-sciences.inleiding`; decide the retirement/redirect behavior of
   `other` explicitly. Psychodiagnostics is a separate course, not an AWS I rename.
3. Update readers first: URL resolution, choice persistence, frozen manifests,
   preview/review, publisher, and course links must accept legacy and modern values.
4. Generate a fresh release with the qualified manifest and per-bachelor approved
   examples. Do not relabel V1–V5 or their immutable submissions in place. Migrate only
   active records that still need migration, with an explicit mapping and backup.
5. Validate old and new links, no-query return visits, pinned courses, all registered
   courses, Beta-to-Published navigation, history viewing, and rollback. Only then
   make qualified IDs canonical; retain old-link aliases.

## Log

- 2026-10-05: Reproduced the shared-storage/legacy-ID failure. Prepared and tested
  the emergency V5 runtime patch and future generated-runtime fix. Pending approvals,
  existing content snapshots and the Studio sample are untouched.
