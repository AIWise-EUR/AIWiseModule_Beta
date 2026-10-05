# Activate Studio boxes and text formatting

Owner rollout. Existing requests and versions stay unchanged. The SQL only replaces
validation functions and adds one read-only capability RPC; it performs no content
or submission data migration.

1. Deploy the updated Beta `development` source and confirm its Pages workflow passes.
   The new editing controls remain off until step 3. Existing text editing works.
2. In the Supabase Dashboard, redeploy both existing functions from their complete
   updated entry-point files, keeping their existing configuration/secrets:
   - `GitHub-Publish` (case-sensitive slug): `functions/github-publish/index.ts`
   - `aiwise-release`: `functions/aiwise-release/index.ts`
   Each is self-contained. Preserve the existing Verify JWT OFF setting; the functions
   continue to authenticate their callers internally. No new credentials or grants.
3. Run the complete `STUDIO_BLOCKS_SETUP.sql` in the SQL Editor. It is transactional
   and safe to repeat. Apply **after both functions** so newly approved requests can
   be archived and published. This enables `workspace_studio_capabilities()`.
4. Read-only verification:
   ```sql
   select public.workspace_studio_capabilities();
   select status, count(*),
     md5(string_agg(id::text || ':' || md5(to_jsonb(s)::text), ',' order by id)) as fingerprint
   from public.workspace_submissions s group by status order by status;
   ```
   Compare with the pre-rollout audit in `docs/studio-block-editing.md`. Concurrent team
   activity can legitimately change fingerprints; do not overwrite it to match.
5. Run `checks/live-check.ts` using its header command. Sign in to the real Workspace,
   open English Common Studio C2, add a box after the Motor/bodily gradient row,
   save/reload and send the intended content for review. Verify the author is the
   authenticated user and the new request is Team/Pending. Do not approve as a test.

Do not rewrite older pending requests or already-prepared release candidates. After
real approval, prepare a fresh release from the new source. The currently published
student version remains unchanged until the normal publishing action.

If rollout must stop before activation, leave the capability absent and keep the
frontend gate off. After new content is approved, do not roll back to renderers that
lack the extension. Disabling new authoring is safer than stripping saved content.
