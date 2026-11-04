# Activate shared English / Dutch layout approvals

Prepared 2026-11-05. Installation has not been applied to the live project.
Per AGENTS.md, the owner applies SQL and Edge Functions in the Supabase dashboard,
unless the owner explicitly delegates this deployment.

1. Deploy the updated `supabase/functions/github-publish/index.ts` to the existing
   **GitHub-Publish** function. Preserve its name, secrets and authentication settings.
   This retains provisional-language flags in approved archives. No aiwise-release
   update is required.
2. Run `supabase/BIDIRECTIONAL_LAYOUT_SETUP.sql` in the SQL editor, after all earlier
   migrations including EXAMPLE_BOXES_SETUP. The transaction adds metadata columns
   and guarded approval functions; it does not rewrite existing content, submissions,
   decisions or frozen releases. Re-running it is supported.
3. Refresh Workspace. `workspace_studio_capabilities()` must return
   `bidirectional_layout: 1` alongside all four earlier capabilities.
4. Run the read-only command in `checks/live-check.ts`. Compare existing source
   slots, approved slots and submission snapshots before/after activation. Existing
   content must remain identical; new flags default to false and layout_plan to null.
5. In DPAS Nederlands, open C2 and C3. All existing example fields, empty critique
   items, Markdown/XML templates and the full example must open in Edit item.
   C2 also permits Self–AI / Self–Team additions. Use real content only through the
   normal save, submit and three-step approval process.

Frontend controls are gated on step 2. Deploy the worker before the SQL so that
archives cannot lose the new flags. Beta frontend deployment may precede activation.
Student publication remains a separate action; this installation does not publish.

## Behavior and safeguards

- Initial added-box order uses English, retaining boxes unique to either language.
  Thereafter reviewed structural edits work in both directions.
- Box UUIDs and per-draft example/SAT origin mappings retain opposite-language text
  and rich formatting through reorder and duplication. New counterpart fields are
  empty. Text-only edits remain independent.
- Approval previews both languages. The server recalculates the counterpart and
  rejects changed baselines or mismatched previews. Both language writes commit
  together. Removed text remains in the immutable before/after approval history.
- A counterpart with no authored approval is marked structure_only. Such Dutch
  copies stay editable but are excluded from public reads and fresh release snapshots
  until a human approves that language. Existing approved translations remain visible.
- Original pending requests keep their existing approval behavior. New layout requests
  cannot use the older single-language approval endpoint.
- Existing incompatible example counts or stale saved drafts stop for review instead
  of guessing a translation mapping. Original browser drafts remain recoverable.

## Verification

The local PostgreSQL migration-chain test covers both directions, Common and DPAS,
rich text preservation, deletion history, no-op language review, exact preview
validation, stale counterpart refusal, permissions and repeated installation.
The browser fixture `workspace/tests/dpas-layout-preview.cjs` serves the real Studio
with isolated local drafts and simulated admin/backend reads, without live submissions.
