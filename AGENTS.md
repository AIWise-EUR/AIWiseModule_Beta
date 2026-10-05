# Working in this repository

AI-Wise Beta: the module pages, the team workspace, and the Supabase backend behind
them. `development` is the working branch and deploys to the Beta site on every push.
The student site is a separate repository, `AIWise-EUR/AI-Wise`, written by the
publisher bot.

## Layout

- `common/`, `course-specific/`, `pipelines/` — module pages and their loaders
- `common/courses/registry.json` — the bachelors and their courses; the only place a course is declared
- `workspace/` — team workspace (Studio, Control Tower, Beta review, Published)
- `supabase/` — migrations, Edge Functions, setup notes, tests
- `content/approved/` — approved content committed by the bot; do not edit by hand
- `checks/` — test runner and read-only live check
- `docs/` — working records for larger changes

## Before you change anything

1. `git fetch` and start from the latest `development`.
2. Read the record for the area you are touching. Active work:
   [docs/course-structure.md](docs/course-structure.md) — bachelor – course structure;
   [docs/ai-port.md](docs/ai-port.md) — the team's own AI assistants and the WorkSpace.
3. More than one agent works here. If a record names a step as in progress, do not
   start on it; pick another or ask the owner.

## Before you push

- `sh checks/run-tests.sh` must pass.
- Update the Status table and add a Log line in the record you worked from.
- SQL and Edge Function changes are applied by the owner in the Supabase dashboard.
  Ship them with a setup note in `supabase/`, and say so in your summary.
- After the owner applies them, run `checks/live-check.ts` (command in its header).

## Things that have gone wrong here

- Edge Function slugs are case-sensitive. The deployed commit worker is
  `GitHub-Publish`; the source folder is `supabase/functions/github-publish`.
- Local tests pass against a temporary database and a simulated GitHub. They do not see
  deployed function names, real rows, or Supabase safeguards. Check the live project.
- Requests marked "Browser only" in Control Tower live in one browser's storage and
  never reach Beta. Only "Team" requests do.
