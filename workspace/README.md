# AI-Wise workspace navigation prototype

The repository root opens this workspace. The existing Beta module remains available at `../common/lobby.html`.

## Supabase connection foundation (27 September 2026)

`supabase-config.js` contains the project's public URL and publishable key. `supabase-connection.js` exposes `AIWiseBackend.getClient()` (a lazy, shared Supabase JS 2.117.2 client) and `AIWiseBackend.checkConnection()` (a read-only Auth settings request). The latter verifies project reachability and public-key acceptance only; it does not verify table permissions or shared storage. These scripts are loaded by the workspace shell without starting requests on page load. The SDK is fetched from a pinned jsDelivr URL only when the client is requested.

Email/password sign in and a development-team membership check are now available from the sidebar's Sign in button in both Workspace and Course Profiler. `auth.js` restores sessions, validates the user through Supabase Auth, and checks the administrator-managed `workspace_members` table. `auth-ui.js` provides the account dialog. Setup instructions and the required SQL migration are in `../supabase/README.md`; they still need to be applied by the project administrator. The account dialog now offers Create account with email confirmation and separate administrator approval; see the Supabase setup guide for signup, callback URL, and SMTP settings.

Account creation now includes a display name. Existing users can set or change it in the account dialog, and the sidebar shows the saved name. Names are stored in Supabase Auth user metadata and restored with the verified account; they are not unique login IDs or permission flags.

Existing course registrations, drafts, and Control Tower records still use their original localStorage keys. Signing in does not upload them, and signing out does not erase them. The static prototype is still publicly accessible. The membership indicator does not protect existing static pages or local tools; shared Content Studio submissions enforce membership and administrator approval in Postgres. Never add secret keys, service-role keys, database passwords, or access tokens to browser files.

Password login remains direct. Signup confirmation returns to `auth-confirm.html`, which clears callback credentials and asks the user to sign in. Automatic URL session detection stays disabled so it cannot consume workspace hash navigation. Password recovery and OAuth are not implemented. Accounts and membership are separate: users can register, but only an administrator can grant team membership through the Supabase dashboard. A Workspace approval screen is not included. No live Auth users, tables, or project settings were changed by adding these files.

## Included

The map and list views open Course Profiler, Course Profiler Manager, Content Studio, Common Studio, Control Tower, and Beta. Published links open the live student site at `https://aiwise-eur.github.io/AI-Wise/` in the same tab. The legacy `#published` route redirects there too. This is a link to the existing student site, not a new Control Tower release or an approval record. The Approval gate opens the Beta to Published submission route. Hash routes support browser back navigation and direct links.

Common Studio appears below Course Profiler Manager and Content Studio on the home map, with a third road joining the route through Control Tower to Beta. It is also available in the list and shared sidebar. Its entry page opens the C1–C3 shared-content editors and the Common Studio request queue. The editor reuses Content Studio’s preview, item picker, resizable side panel, chapter draft controls, and review submission dialog.

Course Profiler is the teacher's design tool, available through the sidebar, List view, and Manager. The map concentrates on the development workflow: Course Profiler Manager sits above Content Studio and Common Studio in the left column, leading through Control Tower to Beta and Published. Its entry screen at `#manager` describes review and package preparation, links the teacher tool and existing AWS1 prompt/activity previews, and opens the existing Control Tower queue. Manager does not approve transfers. Teacher intake, shared profile versions, and package assembly are not implemented. These role labels do not enforce permissions. Legacy `#profiler` and `#profiler/profile` still open the teacher editor; legacy prompt/activity links remain valid and appear under Manager.

Control Tower displays Course Profiler Manager on the existing `profiler` and `rev-profiler` routes. Route IDs, saved requests, and event records are unchanged; those existing routes now represent the development team side of the process. Teacher-to-Manager intake has no transfer or request lane implemented.

Control Tower starts in map view at every screen size. The map stays above the request list when a route is selected, and list view is also available. Roads show pending, new, and urgent counts from records in this browser. Hovering or focusing a road opens a summary without marking requests as read; clicking the road or View requests opens its queue. The view choice is retained within the current page session.

The tower supports Course Profiler Manager, Content Studio, and Common Studio submissions to Beta, Beta revision requests back to those three spaces, and Beta release requests to Published. Common Studio can attach a fixed copy of a saved shared-content chapter to its existing request lane.

## Control Tower request prototype

`control-tower.js` provides request forms, drafts, submission, filtering, review decisions, linked resubmissions, and a JSON records export. Data is stored under `aiwise_control_tower_v1` in localStorage. Content Studio submissions use the signed-in account's display name and ID when available; otherwise they ask for a name. Reviews and manual request forms still use the separate local profile under `aiwise_control_tower_person_v1`. Those local records have no role enforcement or synchronization. New Content Studio submissions use the shared flow described below. Changing the local name allows the review flow to be tried from another named perspective. It is not an authorization mechanism.

The request form contains title, target item/course, exact version, target reference, request details, expected outcome, references, and priority. Urgent requests require a reason. Submissions add a change summary, revision requests add an affected location, and release requests add an exact assembly and review result. Requestor, timestamps, route, and state are recorded when saving.

Drafts can be edited. Submitted request text stays fixed in the UI. A reviewer can approve, request revision, or reject, always with a reason. Resubmission creates a linked child request and preserves the previous text and decision. Approval is separate from application: delivery is not connected and the application state remains Not applied. Target URLs and version references identify artifacts; this prototype does not capture immutable copies of linked artifacts.

Pending counts only requests awaiting a decision. New counts pending requests not yet opened by the current named local reviewer, and is shown as unavailable until a name is set. Urgent counts pending requests explicitly flagged urgent. New and Urgent overlap. Opening a request marks it read without approving it. No sample requests are seeded. Read marks are stored per local profile, and view previews do not mark records as read.

Storage failures are reported without claiming a successful save. Invalid stored data is not silently replaced. Request revisions are checked before updates so a stale form does not overwrite a request changed in another view. Browser storage can be cleared; Export records provides a local backup. These records do not write to the repository, Analytics, or the student site.

The map uses inline SVG building and product illustrations, following the approved 2D campus concept. Beta and Published sit on a horizontal release path within Product Review & Release. Small screens start with the list view; the full map remains available by horizontal scrolling.

The workspace and its entry screens follow the Course Profiler visual theme: warm paper background, Space Grotesk headings, Inter body text, JetBrains Mono labels, and compact cards and controls. Shared tokens live in `theme.css`, also loaded by Course Profiler. The student module previews retain their existing design.

`sidebar.js` and `sidebar.css` provide the same left navigation in the workspace and Course Profiler. AI-Wise branding, area links, and the Beta module link are inside the sidebar; there is no global top bar. The menu starts closed on every page and slides over the content in 300 ms, leaving the main layout, map dimensions, and scrollbar unchanged. A narrow rail holds the reopening button. Clicking outside, pressing Escape, choosing a link, or using the close button dismisses the menu. Background content is inert while the menu is open, with keyboard focus contained in the drawer. Reduced motion disables the transition. The former `aiwise_sidebar_expanded_v1` preference is no longer read or written. The area navigation marks the current area, including nested pages and Records Office. Course Profiler Manager, Content Studio, and Beta carry a chevron: hovering the row, focusing its link, pressing the chevron, or pressing Right arrow slides a second column out to the right listing that area's items (registered courses for Manager and Content Studio; C1–C3 and connected courses for Beta). Opening the drawer from one of those pages shows the column already out with the current item marked and its parent in bold. Hovering another such area switches the column; the chevron closes it. Left arrow returns to the area link, Up and Down move between items. Below 640 px there is no room for a second column, so the items expand beneath their area instead. Area pages have no breadcrumb row or area label: the heading shows the page title and, where a page supplies one, a single description line. Course Profiler retains a light toolbar for editing and export actions, plus its contextual profile, prompts, and activities links.

Course Profiler opens the supplied `course_profiler_11(1).html` prototype at `course-profiler/`. It supports course editing, browser local storage, and JSON / Markdown exports. Its existing wording, sample content, and storage keys are preserved. A Workspace link returns to the map, and Current prompts / Current activities links retain access to the existing AWS1 previews. Legacy `#profiler` and `#profiler/profile` links also open the editor. Course profiles are saved only in the current browser; they are not submitted to Control Tower or synchronized to GitHub.

Content Studio offers a visual editor for AWS1 and PED C2/C3 course content, described below. Beta links to the working Common pages and course previews. C2/C3 previews read the current approved Supabase chapter content over the repository source. Other previews still read repository files.

## Content Studio visual editor

Open `#studio/aws1` or `#studio/ped`, then use the item picker, which groups all available items under C2 and C3. There are no separate chapter buttons. Selecting an item from another chapter opens that chapter and scrolls to the chosen item. Direct chapter links use `#studio/<course>/c2` and `#studio/<course>/c3`; an optional zero-based item index can follow the chapter. The item catalog comes from the existing `data-slot` attributes and selected course JSON. No source files have moved and no module classifications have changed. The area heading shows only the page title. The item picker shows the title only, at the same height as the toolbar buttons, with the “Course item · n / total” label above the box.

C2 exposes the six existing example cards for both courses, plus the S.A.T worked example for PED (seven PED items, with its title inside the same editor). AWS1 has no S.A.T source data; those two slots are explicitly listed as not configured. C3 exposes all 15 existing slots in 14 selectable items for each course: six prompt technique examples, four critique examples, the Adopt/Modify/Discard example, Markdown and XML comparison templates, and the full worked example with its title in the same editor. C1 has no course slots. Common content remains read-only in this studio.

Choose an item from the picker to reveal it, then click the outlined preview item to edit it. The redundant Edit item and Go to item toolbar buttons have been removed. The resizable right-hand overlay preserves the preview width. Structured examples expose their nested text fields; speaker and Adopt/Modify/Discard tags use constrained choices. Existing array lengths and object structure are preserved; adding, deleting or reordering cards, phases, steps and template sections is not included. Edits update the preview immediately. Title-only slots are grouped with their examples rather than listed separately; stored slot keys are unchanged. The item picker can reopen while its closing animation is in progress. Delayed editor-close events preserve focus in a newly opened picker. The item picker reveals hidden technique tabs, critique slides and collapsed worked examples. Carousel arrows, technique tabs, critique navigation and local section links work without running the module's scripts.

The real module HTML and existing `course-loader.js` renderers are reused. The preview removes module scripts, event handlers and embedded frames; CSP blocks scripts, connections and form submissions. All edited course values are rendered as text. The iframe permits parent-installed handlers at the sandbox level for WebKit compatibility. It does not collect analytics or submit module feedback.

Drafts are isolated by course and chapter under `aiwise_content_studio_<course>_<chapter>_v1`. C2 retains the original `schema: 1`, `slot: c2.examples`, `examples` and `baseExamples` fields and adds `slots`/`baseSlots` for S.A.T. Existing C2 drafts without those fields restore their saved examples and use current source S.A.T content. C3 stores all chapter slots and their source baseline. Save and reset both detect intervening changes from another tab. Invalid records or changed source baselines are preserved and block saving until explicit reset. Unsaved edits require confirmation before leaving or changing chapters. Storage errors never claim a successful save.

Save draft writes one mutable browser draft, not shared storage, version history or a Beta update. Reset affects only the selected course and chapter. Saved C2 and C3 drafts appear in home activity with links to the corresponding editor.

After saving, Send to Control Tower requires an active signed-in team member and creates a shared Pending request in Supabase. Its immutable chapter copy and source baseline are visible to other active members. The server derives the author from Auth, validates every slot against the current baseline, and deduplicates retries. Requests show Team or Browser only; old browser records are retained without automatic upload. Refresh requests retrieves other accounts' latest submissions and decisions.

Only a member with database role `admin` can approve, request revision, or reject a shared request. Approve & apply to Beta changes the request and active chapter in one database transaction. It rejects stale revisions and submissions based on an older Beta version. Beta C2/C3 pages fetch the approved slots on load; open pages need a reload. Published, repository JSON and Common content are unchanged. Earlier submitted copies remain available. Studio also starts from current approved content; an older local draft is preserved and blocked for explicit reset/reconciliation. A revision request is handled by saving and sending a new Studio draft; automatic parent-child linking for shared revisions is not included.

Database setup and rollout order are in `../supabase/SHARED_STUDIO_SETUP.md`. Apply the migration before deploying these frontend changes. Pending data is member-only; only approved Beta content is publicly readable, matching the existing public Beta site.

Browser verification: `tests/studio-courses.browser.cjs` checks existing course navigation and C2 isolation; `tests/studio-slots.browser.cjs` exercises all C3 slot types for both courses, S.A.T, legacy C2 restoration, safe text rendering, hidden content, unsaved chapter navigation, stale sources, cross-tab conflicts, chapter resets and mobile layout. `tests/shared-studio.browser.cjs` (also invoked by `studio-submission.browser.cjs`) exercises the real SDK with two browser accounts against a local PostgreSQL fixture: failed submission retry, shared review, administrator approval, public Beta loading, safe text, stale drafts and sign-out cleanup. `../supabase/tests/shared_studio.cjs` checks RLS, RPC permissions, immutable copies, deduplication, atomic approval, stale releases and revocation. See the setup guide for dependencies. The slot suite uses normal motion by default (set `STUDIO_TEST_MOTION=reduce` for reduced-motion coverage), including immediate menu reopening and selection after editor close. These require Playwright and `CHROMIUM_PATH`; the course test also uses `SUPABASE_TEST_SDK` as described by the signup test.

## Common Studio visual editor

Open `#common` to choose C1, C2, or C3, or use `#common/c1`, `#common/c2`, and `#common/c3` directly. The same Content Studio editor handles both scopes. `pipelines/common-content.js` supplies one shared text catalog for the editor and approved Beta renderer; `common-studio.js` connects it to the editor. Authentication is unchanged.

Common Studio edits the existing chapter headings, explanatory text, table text, card text, diagram labels in inline SVG, and shared template text. The picker lists all three chapters and selecting an item reveals its tab or review step. Click an outlined block or its Edit button to open the same resizable right panel. Edits update the preview as plain text while retaining the source markup, links, emphasis, and layout. Inline text fragments are separate fields to preserve their formatting. Adding/removing blocks and changing links or artwork remain outside this editor. The C1 anatomy map is now an additional item group in Common Studio; its node labels, categories, descriptions, controls and legend text are editable while its geometry and interactions stay intact. Course-specific slots are read-only and display the current AWS1 examples for context.

Drafts use new, independent `aiwise_common_studio_c1_v1`, `aiwise_common_studio_c2_v1`, and `aiwise_common_studio_c3_v1` keys. Each draft holds the chapter source baseline and editable text; source mismatches, malformed storage, stale saves, and storage failures preserve the existing copy and report the issue. Save and reset apply only to the current chapter. Unsaved navigation and reload guards are shared with Content Studio. Saving does not change repository files, Beta, or Published.

Send to Control Tower uses the existing team submission service with `course: common` and the C1, C2, or C3 chapter. The same member/admin rules, immutable snapshots, retry protection, stale-baseline checks, revision decisions, and atomic approval apply. Approved common text appears on Beta after reload, alongside the selected course's approved content. Both editor previews load the latest approved content in their read-only context. Legacy local `commonSnapshot` records remain readable but cannot apply content to Beta. Home’s activity popup links saved Common drafts to their editors.

Apply `../supabase/migrations/20260928132359_common_studio_content.sql` after the shared Studio migration before deploying. It adds three common source baselines and extends the source constraints; it does not change grants, RLS policies, roles or RPCs. See `../supabase/SHARED_STUDIO_SETUP.md` for rollout status.

Validation: `LINKEDOM_MODULE=/path/to/linkedom node --test workspace/tests/common-studio.test.cjs` covers all three catalogs, safe text rendering, course-slot preservation, schema mismatch, database field ordering, and saved-draft submission guards. `LINKEDOM_MODULE=/path/to/linkedom PGLITE_MODULE=/path/to/@electric-sql/pglite node supabase/tests/common_studio.cjs` covers real PostgreSQL member/admin sharing, immutable snapshots, retry deduplication, atomic approval, stale releases, revocation, and exact common source baselines. Manual browser checks cover editing and restoration, keyboard panel resizing, narrow layouts, and existing AWS1/PED editors. Live account submission/approval requires the rollout checks in the setup guide.

## Not implemented

Adding or restructuring authored blocks, media replacement, general shared package storage, Published release activation, restoration, and general Records Office persistence are not implemented. Immutable Beta version history, the Published window viewer, and the full Course Profiler Manager workflow remain upcoming work. Local request decisions are available, but the live Published site is not managed by this prototype. No sample approvals, version histories, or live usage numbers are fabricated.

The account dialog adds authentication and a membership lookup. Shared Content Studio submission and review permissions are enforced by the database; local editing and legacy request flows remain browser tools. This is not a production administration console. No Analytics collection is added.

## Shared workspace motion

`motion.css` and `motion.js` define the motion policy for the workspace home, area screens, Control Tower, Content Studio, sidebar, and Course Profiler. Timings follow the student module: page and dialog fades 380 ms, menus and sidebar 300 ms, control feedback 200 ms, carousel 400 ms. Update these shared tokens rather than adding screen-specific timings. The Content Studio preview retains the module’s own carousel transition.

Route entry, map/list switches, road summaries, and Profiler views use the shared effects. Dialog close timers follow the same tokens and cancel when reopened. Reduced motion removes animation and transition delays. Layout, scrollbars, resize gestures, draft saves, unsaved-change guards, and approval logic remain independent of animation.

## Local review

Serve the repository through a local HTTP server and open `/workspace/`. Also test beneath a repository prefix such as `/AIWiseModule_Beta/workspace/` to check relative paths. Test map and list navigation, all entry screens, prompt selection/copy/download, course examples, existing Beta links, narrow layouts, and keyboard focus.

## Courses

`#courses` opens a course dashboard with cards. The sidebar has two navigation groups: Workspaces and Courses. Courses lists the registered course names, followed by Add course. Selecting a name opens that course's workspace hub with its connected prompts, activities, Content Studio, Beta, and shared Common Studio. Unsupported destinations show Setup needed. Registration changes refresh the sidebar, including in the standalone Course Profiler; its manifest URL is resolved relative to the script, not the current page. Course Profiler and Courses remain in List view and the sidebar but no longer appear on the home map. Course Profiler Manager and Content Studio list the registered courses followed by an Add course card. Common Studio has no Add course card; its C1–C3 items remain shared content.

`courses.js` loads existing courses from `common/courses/index.json`; the generic Others configuration is not treated as an individual course. Add course registers a unique, fixed ID and short/full names. Edit course details updates names. These changes are browser-local under `aiwise_workspace_courses_v1`; they do not modify runtime JSON, teacher profiles, content drafts, Control Tower records, or Published. New registrations appear in Manager and Content Studio with Setup needed until their content and editors are connected. AWS1 and PED both open their own C2/C3 editors; their Beta links open the selected course. Shared persistence and automatic content creation are not implemented.

Invalid saved registration data is preserved with an error. Duplicate/reserved IDs, stale-tab saves, storage failures, and unsaved navigation are handled without claiming successful registration. Existing course name edits affect workspace registration views only; source module wording is unchanged.


## Workspace status

The home header shows browser-local pending/urgent request counts. Its News line now displays 12 short, original workspace tips, one at a time: choosing courses and items, preview editing, resizing the editor, saving/resetting drafts, opening Beta, page help, display names, signup approval, Map/List, and course registration. A random tip starts each page load; tips rotate every eight seconds and pause on hover, keyboard focus, page hiding, explicit Pause, or while the popup is open. Reduced motion starts paused. Previous/next controls wrap through the tips, and text wraps on narrow screens so it remains readable.

Click a tip or View all to open Tips & activity: the complete tip list appears above the existing real local activity. Requests still link to their exact details and saved C2/C3 drafts to the corresponding editor. Tips have no timestamps and are not stored as activity or requests. No team news or sample activity is fabricated. Opening the popup does not mark requests read. Escape, close, and backdrop dismissal use shared motion. Legacy `#updates` links still open this popup over Home, and the rotation timer stops away from Home.


## Course maps

Each course hub starts with a map using the home map layout and illustrations, plus a List option. Links resolve to that course's connected materials: its Manager entry, the AWS1/PED C2/C3 editor where available, and its Beta preview. AWS1 retains the existing student-site link. Unconnected editors, course request views, and releases are explicitly labeled and do not link to another course's content. Common Studio is grayscale on course maps and remains a link to shared content; the global map remains in color. Approval gates on course maps are informational, not release actions. The Manager page and each course's Manager entry have a prominent Open Course Profiler button. The teacher tool still opens its current browser profile, with no automatic course switching.

## Page headings and help notes

Area headings show the page title as plain text, without a card, and use full course names (Academic Writing Skills I rather than AWS1). Explanatory sentences, scope notes, and browser-only caveats no longer sit on the page. Each area passes them to the shared `shell()` as HTML for a help note: an ⓘ button beside the title opens it with the shared menu motion, and Escape, the button, or a click elsewhere closes it. Short context such as a request's route stays visible as a mono lead line, and error messages keep their visible notice style. Content Studio's coverage summary lives in the help note; its status line is hidden while it has nothing to report, and the preview no longer carries a caption. Control Tower keeps only the local name form above its queue.

The workspace has no footer bar. The home heading greets the person with “Hello”, and adds the account's display name once `AIWiseAuth` exposes a `user.name`; the eyebrow element keeps the id `home-greeting`.

The Content Studio toolbar carries one action, Send to Control Tower. Save draft sits in the editor footer, together with a quiet Reset chapter draft link that refreshes the open item's fields after the confirmation. The Beta preview link lives in the heading's help note instead of the toolbar.


## Beta preview and team feedback

The AI-Wise Beta destination on the home map/list and Control Tower opens a large preview dialog directly. Sidebar chapter links and course hubs open the corresponding module or course in that dialog. Close returns to the previous workspace route. The existing campus, sidebar, account behavior and Published destination remain unchanged.

`beta-review.js` shows the actual current Beta module in an iframe. Page/course controls and internal module links navigate inside the preview. External destinations remain available through Open page. The original student feedback widget is hidden inside this review frame only. Feedback lives in the right panel, below the preview on narrow screens. The dialog uses the existing page/dialog motion and reduced-motion setting.

Add memo enables Comment, Highlight, Box and Pin. Click a content box, select text, drag a rectangle, or point at a position; the Content box picker and Enter on a tagged box provide keyboard alternatives. Media such as the C1 diagram can be selected from the picker. Selected text is represented by text offsets and a quote; boxes/pins use coordinates relative to their content box. Markers are overlays and never rewrite module content. A content fingerprint prevents a stale comment being silently attached to changed text. Such threads remain readable with an unavailable-location notice. This reviews current Beta, not a fabricated historical version or immutable release snapshot.

Approved team members can read/post comments and replies. The author or an administrator can resolve/reopen a thread. Refresh retrieves teammates' changes; no realtime subscription is added. The page and course context keep feedback separate. Comments and author information are private to active team members, independent of public approved Beta content. Author identity/timestamps come from the server. New comments and replies are immutable; retrying the same client UUID cannot create duplicate rows. Sign-out/account changes clear the panel. Network errors preserve unsent text; changing pages, closing, and refresh guard it. No browser drafts are uploaded automatically.

Before deployment apply `../supabase/migrations/20260928151827_beta_review_feedback.sql`, following `../supabase/BETA_FEEDBACK_SETUP.md`. This adds two private team tables, constrained anchors and column-level grants, RLS, indexes, and a trigger-only author stamp in a private schema. Existing account, role, content approval and public Beta contracts are unchanged.

Validation: `LINKEDOM_MODULE=/path/to/linkedom node --test workspace/tests/beta-review.test.cjs` covers anchor restoration/staleness, media, reverse dragging, retry identity, sign-out races, and setup/permission failures. `PGLITE_MODULE=/path/to/@electric-sql/pglite node supabase/tests/beta_feedback.cjs` verifies actual PostgreSQL RLS, derived authors, immutable text, replies, author/admin resolution, invalid anchors, duplicates and revocation. A separate local UI fixture verified all four marker tools, posting/replying, resolving/reopening, failed save/retry, and keyboard target selection without live writes. The actual Workspace route was checked signed out: the Beta box opens the dialog directly and keeps team actions unavailable. A 390×844 layout check confirmed no horizontal overflow and accessible preview/panel regions. Live account posting remains a rollout check after the user's SQL application.


## English and Nederlands content spaces

Common Studio and Content Studio retain their existing campus entries and editor. A Language control selects English or Nederlands, with separate browser drafts, team submissions, approvals and Beta feedback. This is a translation workspace, not a completed Dutch translation or a translation of the Workspace interface. English remains the default. No Published release is changed.

Coverage is split by content ownership:

- Common Studio: C1–C3 headings, explanations, tables, inline diagram text, templates, navigation, control labels, accessibility text and runtime labels. The item picker also includes the separate C1 system map, including all 22 nodes and their descriptions.
- Content Studio: every configured C2/C3 course slot for AWS1, PED and the generic Other courses examples. Optional S.A.T examples remain absent where the course has none; no invented example is added. Course registration is still the place for course identity.
- Artwork, document structure, the module landing page and Workspace interface are not translation editors in this change.

Each Dutch field offers Show English source. Its starting text is explicitly identified as English, and nothing is automatically approved as Dutch. If an English approval changes, the saved translation remains editable but submission requires an explicit source review. Saving alone does not acknowledge that review. The database checks the English reference again at submission and approval, including concurrent updates.

English storage keys and feedback URLs are preserved. Dutch drafts add `_nl` before `_v1`; module URLs use `lang=nl`. Compatible old English Common drafts retain their edits and ask for one explicit save to add newly editable fields. Incompatible drafts are preserved and blocked for reconciliation. Already submitted Common copies remain immutable; the migration normalizes the live catalog and adapts legacy pending approvals.

Beta has Page, Course and Language controls. Its actual module frame waits for approved common and course content before attaching feedback. The C1 map can also be opened directly. Internal chapter/course navigation carries the selected language. A page with no approved Dutch common/course content shows its English fallback with a visible notice. Feedback remains private to active members and separate for each language.

Rollout requires `../supabase/CONTENT_LANGUAGES_SETUP.md`. This branch is not evidence that SQL or GitHub Pages was deployed. Run the language DOM tests plus the isolated PostgreSQL migration suite described there. Local browser checks use mock data and do not verify a live team account.


## Approved-content GitHub commits

Studio approvals can now enqueue automatic content commits to `AIWiseModule_Beta/development`.
Control Tower shows commit and Pages deployment status separately. Enable the server queue,
worker and recovery schedule following [../supabase/GITHUB_PUBLISHING_SETUP.md](../supabase/GITHUB_PUBLISHING_SETUP.md).
The existing connection-check function alone does not enable publishing.
The separate `AI-Wise/main` student release path is not changed by this setup.


## Workspace guides and selection lists

`select-controls.js` enhances single-choice selects in Workspace and Course Profiler while retaining the original select, field names, values, validation and change handlers. Option lists share the Workspace styles, display the selected item and search lists longer than eight choices. Arrow keys move through choices, Enter selects, Escape cancels and Tab continues navigation. Dynamically rendered controls and programmatic changes are mirrored. Common and Content Studio's chapter/item picker also supports search and keyboard selection. Module iframe controls are outside this enhancement.

`tutorial-content.js`, `tutorials.js` and `tutorials.css` provide card guides for sign-in, first approved login, all Workspace areas, studio editors, Beta preview, publication, Account and My page. Members receive the Beta review welcome; administrators receive the content workflow welcome. Guides open on first visit and can be reopened from the top-right information button. Cards support Next/Back, direct card selection, arrow keys and touch swipes. A Workspace tour link reopens the role-appropriate welcome. Account sign-in completes before the welcome appears; no authentication behavior is changed.

Dismissed guides are remembered under `aiwise_guides_v1:<account>:<role>:<guide>` in this browser. A different account, role or browser has separate first-visit state. Storage failure falls back to the current session. This preference is not synchronized through Supabase. The guide content identifies local/prototype areas without claiming they are shared or implemented.

Validation: 67 Workspace unit tests pass, including new selection synchronization/keyboard/search tests and tutorial account/role/navigation tests. Local browser checks cover Beta course/page changes, searchable feedback targets, Studio item search, first sign-in and member onboarding, My page, guide reopening, Course Profiler and 390×844 layouts. The browser fixture uses local mock accounts and content; these checks do not create production submissions or feedback.
