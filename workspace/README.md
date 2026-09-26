# AI-Wise workspace navigation prototype

The repository root opens this workspace. The existing Beta module remains available at `../common/lobby.html`.

## Included

The map and list views open Course Profiler, Course Profiler Manager, Content Studio, Common Studio, Control Tower, and Beta. Published links open the live student site at `https://aiwise-eur.github.io/AI-Wise/` in the same tab. The legacy `#published` route redirects there too. This is a link to the existing student site, not a new Control Tower release or an approval record. The Approval gate opens the Beta to Published submission route. Hash routes support browser back navigation and direct links.

Common Studio appears below Course Profiler Manager and Content Studio on the home map, with a third road joining the route through Control Tower to Beta. It is also available in the list and shared sidebar. Its entry page describes the shared content scope, links to existing C1–C3 Beta previews, and opens the Common Studio request queue. Content editing is not implemented.

Course Profiler is the teacher's design tool, available through the sidebar, List view, and Manager. The map concentrates on the development workflow: Course Profiler Manager sits above Content Studio and Common Studio in the left column, leading through Control Tower to Beta and Published. Its entry screen at `#manager` describes review and package preparation, links the teacher tool and existing AWS1 prompt/activity previews, and opens the existing Control Tower queue. Manager does not approve transfers. Teacher intake, shared profile versions, and package assembly are not implemented. These role labels do not enforce permissions. Legacy `#profiler` and `#profiler/profile` still open the teacher editor; legacy prompt/activity links remain valid and appear under Manager.

Control Tower displays Course Profiler Manager on the existing `profiler` and `rev-profiler` routes. Route IDs, saved requests, and event records are unchanged; those existing routes now represent the development team side of the process. Teacher-to-Manager intake has no transfer or request lane implemented.

Control Tower starts in map view at every screen size. The map stays above the request list when a route is selected, and list view is also available. Roads show pending, new, and urgent counts from records in this browser. Hovering or focusing a road opens a summary without marking requests as read; clicking the road or View requests opens its queue. The view choice is retained within the current page session.

The tower supports Course Profiler Manager, Content Studio, and Common Studio submissions to Beta, Beta revision requests back to those three spaces, and Beta release requests to Published. Common Studio is represented as a request destination here; its content editor is not yet built.

## Control Tower request prototype

`control-tower.js` provides request forms, drafts, submission, filtering, review decisions, linked resubmissions, and a JSON records export. Data is stored under `aiwise_control_tower_v1` in localStorage. The separate local profile name is stored under `aiwise_control_tower_person_v1`. There is no login, verified identity, role enforcement, or synchronization between browsers. Changing the local name allows the review flow to be tried from another named perspective. It is not an authorization mechanism.

The request form contains title, target item/course, exact version, target reference, request details, expected outcome, references, and priority. Urgent requests require a reason. Submissions add a change summary, revision requests add an affected location, and release requests add an exact assembly and review result. Requestor, timestamps, route, and state are recorded when saving.

Drafts can be edited. Submitted request text stays fixed in the UI. A reviewer can approve, request revision, or reject, always with a reason. Resubmission creates a linked child request and preserves the previous text and decision. Approval is separate from application: delivery is not connected and the application state remains Not applied. Target URLs and version references identify artifacts; this prototype does not capture immutable copies of linked artifacts.

Pending counts only requests awaiting a decision. New counts pending requests not yet opened by the current named local reviewer, and is shown as unavailable until a name is set. Urgent counts pending requests explicitly flagged urgent. New and Urgent overlap. Opening a request marks it read without approving it. No sample requests are seeded. Read marks are stored per local profile, and view previews do not mark records as read.

Storage failures are reported without claiming a successful save. Invalid stored data is not silently replaced. Request revisions are checked before updates so a stale form does not overwrite a request changed in another view. Browser storage can be cleared; Export records provides a local backup. These records do not write to the repository, Analytics, or the student site.

The map uses inline SVG building and product illustrations, following the approved 2D campus concept. Beta and Published sit on a horizontal release path within Product Review & Release. Small screens start with the list view; the full map remains available by horizontal scrolling.

The workspace and its entry screens follow the Course Profiler visual theme: warm paper background, Space Grotesk headings, Inter body text, JetBrains Mono labels, and compact cards and controls. Shared tokens live in `theme.css`, also loaded by Course Profiler. The student module previews retain their existing design.

`sidebar.js` and `sidebar.css` provide the same left navigation in the workspace and Course Profiler. AI-Wise branding, area links, and the Beta module link are inside the sidebar; there is no global top bar. The menu starts closed on every page and slides over the content in 300 ms, leaving the main layout, map dimensions, and scrollbar unchanged. A narrow rail holds the reopening button. Clicking outside, pressing Escape, choosing a link, or using the close button dismisses the menu. Background content is inert while the menu is open, with keyboard focus contained in the drawer. Reduced motion disables the transition. The former `aiwise_sidebar_expanded_v1` preference is no longer read or written. The area navigation marks the current area, including nested pages and Records Office. Course Profiler retains a light toolbar for editing and export actions, plus its contextual profile, prompts, and activities links.

Course Profiler opens the supplied `course_profiler_11(1).html` prototype at `course-profiler/`. It supports course editing, browser local storage, and JSON / Markdown exports. Its existing wording, sample content, and storage keys are preserved. A Workspace link returns to the map, and Current prompts / Current activities links retain access to the existing AWS1 previews. Legacy `#profiler` and `#profiler/profile` links also open the editor. Course profiles are saved only in the current browser; they are not submitted to Control Tower or synchronized to GitHub.

Content Studio offers a visual editor for AWS1 C2 examples, described below. Beta links to the working Common pages and course previews. These previews read the current files, not fixed historical snapshots.

## Content Studio visual editor

Open `#studio/aws1`. The actual C2 module page is shown inside a sandboxed preview, with only the six existing course example cards outlined for editing. Clicking a card or choosing an example and pressing Edit example opens a right-hand overlay. The preview width stays unchanged. Title, student thinking, context note, typed prompt, and model processing text update immediately. Common content remains read-only; adding, removing, or reordering examples is outside this version. The editor uses the module’s 380 ms ease fade for opening and closing, 300 ms menu motion, and 200 ms control feedback. The preview keeps the original 400 ms carousel transition. Reduced motion disables these effects; resizing responds immediately.

`content-studio.js` fetches the existing C2 HTML and AWS1 JSON. Module scripts and inline event handlers are removed from the preview. A Content Security Policy blocks script execution within the preview. The frame permits scripting at the sandbox level so WebKit can dispatch events to the parent-installed listeners; the module’s own scripts remain blocked by CSP. The parent uses the existing `course-loader.js` renderers through its explicit `data-render-only` mode, without starting the course chooser, changing course preferences, or collecting feedback. Preview carousel and section controls are connected by the editor. Previous/next arrows and example dots update the same selection as the styled toolbar picker, in both directions. The picker supports numbered choices, arrow keys, Home/End, and Escape. The separate Open C2 in Beta link opens the unmodified module in a new tab.

Save draft stores only the C2 examples and their source baseline in `aiwise_content_studio_aws1_c2_v1`. This is one mutable browser draft, not version history, a shared package, or a Beta update. Reset draft explicitly discards it and returns to the current Beta content. Unsaved edits trigger a warning before leaving. Storage failures and stale saves are reported; invalid or source-mismatched drafts are left unchanged until an explicit reset. Content Studio does not offer draft export. No file, Control Tower request, or Published content is changed by editing or saving.

## Not implemented

Editing beyond AWS1 C2 examples, Common Studio editing, shared package storage, authenticated manager permissions, immutable artifact storage, release activation, restoration, and general Records Office persistence are not implemented. Beta annotations, the Published window viewer, and the full Course Profiler Manager workflow remain upcoming work. Local request decisions are available, but the live Published site is not managed by this prototype. No sample approvals, version histories, or live usage numbers are fabricated.

This prototype has no authentication or access control. It should not be treated as a production administration console. No deployment configuration or Analytics collection is added.

## Shared workspace motion

`motion.css` and `motion.js` define the motion policy for the workspace home, area screens, Control Tower, Content Studio, sidebar, and Course Profiler. Timings follow the student module: page and dialog fades 380 ms, menus and sidebar 300 ms, control feedback 200 ms, carousel 400 ms. Update these shared tokens rather than adding screen-specific timings. The Content Studio preview retains the module’s own carousel transition.

Route entry, map/list switches, road summaries, and Profiler views use the shared effects. Dialog close timers follow the same tokens and cancel when reopened. Reduced motion removes animation and transition delays. Layout, scrollbars, resize gestures, draft saves, unsaved-change guards, and approval logic remain independent of animation.

## Local review

Serve the repository through a local HTTP server and open `/workspace/`. Also test beneath a repository prefix such as `/AIWiseModule_Beta/workspace/` to check relative paths. Test map and list navigation, all entry screens, prompt selection/copy/download, course examples, existing Beta links, narrow layouts, and keyboard focus.

## Courses

`#courses` opens a course dashboard with cards. The sidebar has two navigation groups: Workspaces and Courses. Courses lists the registered course names, followed by Add course. Selecting a name opens that course's workspace hub with its connected prompts, activities, Content Studio, Beta, and shared Common Studio. Unsupported destinations show Setup needed. Registration changes refresh the sidebar, including in the standalone Course Profiler; its manifest URL is resolved relative to the script, not the current page. Course Profiler and Courses remain in List view and the sidebar but no longer appear on the home map. Course Profiler Manager and Content Studio list the registered courses followed by an Add course card. Common Studio has no Add course card; its C1–C3 items remain shared content.

`courses.js` loads existing courses from `common/courses/index.json`; the generic Others configuration is not treated as an individual course. Add course registers a unique, fixed ID and short/full names. Edit course details updates names. These changes are browser-local under `aiwise_workspace_courses_v1`; they do not modify runtime JSON, teacher profiles, content drafts, Control Tower records, or Published. New registrations appear in Manager and Content Studio with Setup needed until their content and editors are connected. The AWS1 C2 editor and PED Beta preview retain their existing destinations. Shared persistence and automatic content creation are not implemented.

Invalid saved registration data is preserved with an error. Duplicate/reserved IDs, stale-tab saves, storage failures, and unsaved navigation are handled without claiming successful registration. Existing course name edits affect workspace registration views only; source module wording is unchanged.


## Workspace status

The home header shows browser-local pending/urgent request counts and a single-line activity carousel instead of the introductory tagline. It reads current Control Tower request states and the saved AWS1 Content Studio draft timestamp without marking requests read. No team news or sample activity is fabricated. The line rotates every six seconds, pauses on hover, keyboard focus, page hiding, or explicit Pause, and starts paused for reduced motion. Previous/next provide manual access. View all opens a modal activity list over Home; requests link to their exact details and saved drafts link to their editor. Opening the list does not mark requests read. Escape, the close button, and the backdrop dismiss it with shared motion and return focus to View all. The ticker pauses while it is open. Legacy `#updates` links open the same popup over Home. The timer stops away from Home. Courses are listed in the sidebar and their dashboard, not duplicated in the status header.


## Course maps

Each course hub starts with a map using the home map layout and illustrations, plus a List option. Links resolve to that course's connected materials: its Manager entry, the AWS1 C2 editor where available, and its Beta preview. AWS1 retains the existing student-site link. Unconnected editors, course request views, and releases are explicitly labeled and do not link to another course's content. Common Studio is grayscale on course maps and remains a link to shared content; the global map remains in color. Approval gates on course maps are informational, not release actions. The Manager page and each course's Manager entry have a prominent Open Course Profiler button. The teacher tool still opens its current browser profile, with no automatic course switching.
