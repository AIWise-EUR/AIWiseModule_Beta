# AI-Wise workspace navigation prototype

The repository root opens this workspace. The existing Beta module remains available at `../common/lobby.html`.

## Included

The map and list views open Course Profiler, Content Studio, Control Tower, Beta, and Published. The Approval gate opens the Beta to Published submission route. Hash routes support browser back navigation and direct links.

The map uses inline SVG building and product illustrations, following the approved 2D campus concept. Beta and Published sit on a horizontal release path within Product Review & Release. Small screens start with the list view; the full map remains available by horizontal scrolling.

Course Profiler opens the supplied `course_profiler_11(1).html` prototype at `course-profiler/`. It supports course editing, browser local storage, and JSON / Markdown exports. Its existing wording, sample content, and storage keys are preserved. A Workspace link returns to the map, and Current prompts / Current activities links retain access to the existing AWS1 previews. Legacy `#profiler` and `#profiler/profile` links also open the editor. Course profiles are saved only in the current browser; they are not submitted to Control Tower or synchronized to GitHub.

Content Studio reads existing AWS1 C2 examples. Beta links to the working Common pages and course previews. These previews read the current files, not fixed historical snapshots.

## Not implemented

Content Studio editing, package submission, approval actions, immutable version storage, release activation, restoration, and Records Office persistence are not implemented. Their entry screens state this explicitly. The Published screen does not claim that a student release is connected. No sample approvals, version histories, or live usage numbers are fabricated.

This prototype has no authentication or access control. It should not be treated as a production administration console. No deployment configuration or Analytics collection is added.

## Local review

Serve the repository through a local HTTP server and open `/workspace/`. Also test beneath a repository prefix such as `/AIWiseModule_Beta/workspace/` to check relative paths. Test map and list navigation, all entry screens, prompt selection/copy/download, course examples, existing Beta links, narrow layouts, and keyboard focus.
