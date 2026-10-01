# Approved Studio content

The `github-publish` Edge Function writes approved content to
`<locale>/<course>/<chapter>.json` in this directory. It commits only to
`AIWise-EUR/AIWiseModule_Beta`, branch `development`.

Each file contains its approval ID, ordering sequence and public content slots.
Private comments, reviewer identity, reasons and unapproved drafts are excluded.
Do not manually edit these generated files. Submit revisions through Studio.

Beta continues to read live approved content from Supabase. These deployed files
provide its explicitly labelled fallback during a connection outage, and a Git
history of approvals. Studio source baselines and saved review versions never
use this fallback. No file here changes the separate student Published site.
