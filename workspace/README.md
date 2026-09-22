# AI-Wise workspace navigation prototype

The repository root opens this workspace. The existing Beta module remains available at `../common/lobby.html`.

## Included

The map and list views open Course Profiler, Content Studio, Control Tower, and Beta. Published links open the live student site at `https://aiwise-eur.github.io/AI-Wise/` in the same tab. The legacy `#published` route redirects there too. This is a link to the existing student site, not a new Control Tower release or an approval record. The Approval gate opens the Beta to Published submission route. Hash routes support browser back navigation and direct links.

Control Tower starts in map view at every screen size. The map stays above the request list when a route is selected, and list view is also available. Roads show pending, new, and urgent counts from records in this browser. Hovering or focusing a road opens a summary without marking requests as read; clicking the road or View requests opens its queue. The view choice is retained within the current page session.

The tower supports Course Profiler, Content Studio, and Common Studio submissions to Beta, Beta revision requests back to those three spaces, and Beta release requests to Published. Common Studio is represented as a request destination here; its content editor is not yet built.

## Control Tower request prototype

`control-tower.js` provides request forms, drafts, submission, filtering, review decisions, linked resubmissions, and a JSON records export. Data is stored under `aiwise_control_tower_v1` in localStorage. The separate local profile name is stored under `aiwise_control_tower_person_v1`. There is no login, verified identity, role enforcement, or synchronization between browsers. Changing the local name allows the review flow to be tried from another named perspective. It is not an authorization mechanism.

The request form contains title, target item/course, exact version, target reference, request details, expected outcome, references, and priority. Urgent requests require a reason. Submissions add a change summary, revision requests add an affected location, and release requests add an exact assembly and review result. Requestor, timestamps, route, and state are recorded when saving.

Drafts can be edited. Submitted request text stays fixed in the UI. A reviewer can approve, request revision, or reject, always with a reason. Resubmission creates a linked child request and preserves the previous text and decision. Approval is separate from application: delivery is not connected and the application state remains Not applied. Target URLs and version references identify artifacts; this prototype does not capture immutable copies of linked artifacts.

Pending counts only requests awaiting a decision. New counts pending requests not yet opened by the current named local reviewer, and is shown as unavailable until a name is set. Urgent counts pending requests explicitly flagged urgent. New and Urgent overlap. Opening a request marks it read without approving it. No sample requests are seeded. Read marks are stored per local profile, and view previews do not mark records as read.

Storage failures are reported without claiming a successful save. Invalid stored data is not silently replaced. Request revisions are checked before updates so a stale form does not overwrite a request changed in another view. Browser storage can be cleared; Export records provides a local backup. These records do not write to the repository, Analytics, or the student site.

The map uses inline SVG building and product illustrations, following the approved 2D campus concept. Beta and Published sit on a horizontal release path within Product Review & Release. Small screens start with the list view; the full map remains available by horizontal scrolling.

The workspace and its entry screens follow the Course Profiler visual theme: warm paper background, dark header, Space Grotesk headings, Inter body text, JetBrains Mono labels, and compact cards and controls. Shared tokens and navigation styles live in `theme.css`, also loaded by Course Profiler. The area navigation marks the current area, including nested pages and Records Office. The student module previews retain their existing design.

Course Profiler opens the supplied `course_profiler_11(1).html` prototype at `course-profiler/`. It supports course editing, browser local storage, and JSON / Markdown exports. Its existing wording, sample content, and storage keys are preserved. A Workspace link returns to the map, and Current prompts / Current activities links retain access to the existing AWS1 previews. Legacy `#profiler` and `#profiler/profile` links also open the editor. Course profiles are saved only in the current browser; they are not submitted to Control Tower or synchronized to GitHub.

Content Studio reads existing AWS1 C2 examples. Beta links to the working Common pages and course previews. These previews read the current files, not fixed historical snapshots.

## Not implemented

Content Studio and Common Studio editing, shared package storage, authenticated manager permissions, immutable artifact storage, release activation, restoration, and general Records Office persistence are not implemented. Beta annotations, the Published window viewer, and the separate Course Profiler Manager remain upcoming work. Local request decisions are available, but the live Published site is not managed by this prototype. No sample approvals, version histories, or live usage numbers are fabricated.

This prototype has no authentication or access control. It should not be treated as a production administration console. No deployment configuration or Analytics collection is added.

## Local review

Serve the repository through a local HTTP server and open `/workspace/`. Also test beneath a repository prefix such as `/AIWiseModule_Beta/workspace/` to check relative paths. Test map and list navigation, all entry screens, prompt selection/copy/download, course examples, existing Beta links, narrow layouts, and keyboard focus.
