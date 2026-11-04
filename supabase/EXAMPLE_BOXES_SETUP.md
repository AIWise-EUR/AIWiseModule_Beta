# Activate example-specific C2 boxes

The code is compatible with existing submissions and boxes. Activated on 2026-11-04
by Codex with the owner's explicit authorization for this change: `GitHub-Publish`
v9, `aiwise-release` v11, then the validator migration. Live capabilities and
validation were verified; content and submission row fingerprints were unchanged.
The owner-run dashboard procedure below remains the normal deployment procedure
per AGENTS.md.

1. Replace and deploy `GitHub-Publish` with `supabase/functions/github-publish/index.ts`.
2. Replace and deploy `aiwise-release` with `supabase/functions/aiwise-release/index.ts`.
   Preserve both functions' existing names, secrets, and authentication settings.
3. Run `supabase/EXAMPLE_BOXES_SETUP.sql` in the SQL editor. This only replaces
   validation and capability functions. It does not edit content, decisions, roles,
   requests, or releases. Running it again is safe.
4. Refresh Workspace. `workspace_studio_capabilities()` must include
   `example_boxes: 1` as well as `blocks`, `sat_phases`, and `approval_merge`.
5. Run the read-only command documented in `checks/live-check.ts`. In Content Studio,
   verify a box in Example 1 produces a reminder in Example 2, import it, save a
   draft, reopen it, and confirm edits are independent. Submit only intentional
   authored content through the normal review flow.

The new controls stay disabled until step 3, so old workers cannot receive new
metadata. Both workers must be deployed first. Previously frozen student releases
keep their old code; prepare a fresh release when the team is ready to publish.

Existing boxes on the entire `c2.examples` slot have no recorded authoring example.
They are displayed in the first example without changing their saved text or ID.
Other examples show editor-only reminders. An import creates a new ID and deep
copies the text/formatting; changes thereafter are independent. A shared `family`
identifier suppresses duplicate reminders without sharing content. Moving or
deleting a card updates/removes only that card's boxes. Duplication copies its boxes.
