# Bachelor – course structure: content scopes

Course examples are now stored per bachelor. `aws1` becomes `psychology`, `ped`
becomes `pedagogical-sciences`, and `other` is retired. Background and the full
plan: [`docs/course-structure.md`](../docs/course-structure.md).

## Apply in Supabase

Project: `cvcvdiohckwgpgoxibia`. Do the three steps in one sitting, right after
the matching code is on `development`. Until all three are done, Content Studio
and new approvals do not work.

1. **SQL Editor**: run all of [`CONTENT_SCOPES_SETUP.sql`](CONTENT_SCOPES_SETUP.sql)
   (identical to `migrations/20261004090000_content_scopes.sql`). It is one
   transaction: if any statement fails, nothing is changed. Send the error
   message instead of retrying parts of the script.
2. **Edge Functions → `GitHub-Publish`**: replace `index.ts` with
   [`functions/github-publish/index.ts`](functions/github-publish/index.ts) and
   deploy. Keep Verify JWT **off**. The earlier version rejects the new scope
   ids, so approvals would stay queued without a commit.
3. **Edge Functions → `aiwise-release`**: replace `index.ts` with
   [`functions/aiwise-release/index.ts`](functions/aiwise-release/index.ts) and
   deploy. Keep Verify JWT **off**. The earlier version cannot prepare a release
   from the renamed content.

No secrets, schedules or GitHub App settings change.

## What the script does

- Adds `workspace_content_scopes`, the list of valid scopes (`common` and one row
  per bachelor). Its names are publicly readable; nothing can change it through
  the API. The bachelors must match `common/courses/registry.json`.
- Renames the scope on every live record: content sources, submissions, approved
  Beta content, comment addresses and the working review checks.
- Rewrites comment page addresses from `?course=aws1` to
  `?course=psychology.aws1` and from `?course=ped` to
  `?course=pedagogical-sciences.inleiding`, so comments stay on their page.
  Comments written on the "Other courses" page move to `psychology.aws1`.
- Retires `other`: its history stays, it is left out of Beta and of releases, and
  it accepts no new submissions.
- Leaves saved versions (V1–V5), prepared releases and finished commit jobs
  exactly as they were. When the working copy is compared with an earlier
  version, the earlier ids are read as today's, so the rename itself does not
  appear as a change.

## What to expect afterwards

- A release that was prepared but not yet published must be prepared again.
- "Reviewed" marks on course examples in the current cycle are asked for again
  if those examples changed since V5. Marks on Common content are unaffected.
- Drafts saved in Content Studio under the earlier names are picked up under the
  bachelor's name the next time its editor is opened in the same browser.
- Module links with `?course=aws1`, `?course=ped` or `?course=other` keep
  working and open the course they now name.

## Check

```sql
select id, kind, name, retired from public.workspace_content_scopes order by id;
select course, chapter, locale, submission_id from public.workspace_beta_content order by 1, 2, 3;
```

Expect `common`, `other` (retired), `pedagogical-sciences`, `psychology`, and the
approved PED chapter listed under `pedagogical-sciences`. Then, from the
repository:

```sh
deno run --allow-read=. --allow-net=cvcvdiohckwgpgoxibia.supabase.co,api.github.com,aiwise-eur.github.io,raw.githubusercontent.com checks/live-check.ts
```

## Adding courses and bachelors later

- A course under an existing bachelor: add it to `common/courses/registry.json`.
  No database change.
- A new bachelor: add it to the registry with its content file, insert its row
  into `workspace_content_scopes`, and seed its `c2` and `c3` rows in
  `workspace_content_sources` from that file. Ship this as a migration with a
  setup note.

## Local validation

`supabase/tests/content_scopes.cjs` builds the earlier schema with an approval,
comments, review checks and two published versions, applies this change, and
checks the points above. `workspace/tests/course-loader.test.cjs` covers course
resolution on module pages, including the earlier ids.
