# Approved Studio content

The `github-publish` Edge Function writes approved content to
`<locale>/<scope>/<chapter>.json` in this directory. A scope is `common` or a
bachelor id from `common/courses/registry.json`; every course of a bachelor
shares its examples. It commits only to
`AIWise-EUR/AIWiseModule_Beta`, branch `development`.

Each file contains its approval ID, ordering sequence and public content slots.
Private comments, reviewer identity, reasons and unapproved drafts are excluded.
Do not manually edit these generated files. Submit revisions through Studio.
The one exception so far: when course scopes became bachelors (October 2026),
`en/ped/c2.json` was moved to `en/pedagogical-sciences/c2.json` with its
`course` field renamed and nothing else changed.

Beta continues to read live approved content from Supabase. These deployed files
provide its explicitly labelled fallback during a connection outage, and a Git
history of approvals. Studio source baselines and saved review versions never
use this fallback. No file here changes the separate student Published site.
