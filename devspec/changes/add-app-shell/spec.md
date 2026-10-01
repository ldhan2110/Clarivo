# Spec: add-app-shell

### Requirement: authenticated route group and guard [req-1]
The app SHALL serve every authenticated page from the `(app)` route group behind a guard that redirects anonymous visitors to `/login` and never redirects before the session has been resolved.

#### Scenario: session not yet resolved
- **WHEN** a page under `(app)` renders while the auth store's `status` is `"unknown"`
- **THEN** the shell renders with skeleton placeholders for the user block and the content
- **AND** no navigation to `/login` occurs

#### Scenario: anonymous visitor
- **WHEN** the auth store's `status` resolves to `"anonymous"`
- **THEN** the browser is redirected to `/login`

#### Scenario: signed-in visitor
- **WHEN** the auth store's `status` resolves to `"authenticated"`
- **THEN** the sidebar and the page content render

#### Scenario: login page keeps no shell
- **WHEN** `/login` is opened
- **THEN** no sidebar, drawer or top bar renders on it

---

### Requirement: collapsible sidebar [req-2]
The sidebar SHALL collapse between a 264px panel and a 72px icon rail, persist that choice across reloads, and be toggleable by keyboard.

#### Scenario: collapsing
- **WHEN** the collapse control is activated while the sidebar is expanded
- **THEN** the sidebar narrows to a 72px rail showing icons only
- **AND** nav labels, `Soon` badges, the brand wordmark and the user's name and role are no longer rendered

#### Scenario: keyboard toggle
- **WHEN** `⌘B` (macOS) or `Ctrl+B` is pressed anywhere in the shell
- **THEN** the sidebar toggles between expanded and collapsed

#### Scenario: state survives reload
- **WHEN** the sidebar is collapsed and the page is reloaded
- **THEN** it renders collapsed on first paint, without first rendering expanded

#### Scenario: rail label on hover
- **WHEN** the pointer rests on a nav icon while the sidebar is collapsed
- **THEN** a tooltip shows that item's label

---

### Requirement: grouped navigation with one live section [req-3]
The sidebar SHALL present eight nav items in three groups, of which only Dashboard navigates; the other seven SHALL be visibly unavailable and SHALL NOT navigate.

#### Scenario: the eight items and their groups
- **WHEN** the sidebar renders expanded
- **THEN** group `Workspace` lists Dashboard, Projects, Meetings
- **AND** group `Insights` lists Requirements, Questions, Decisions, Documents
- **AND** group `Account` lists Settings

#### Scenario: Dashboard is live and marked active
- **WHEN** the current route is `/`
- **THEN** the Dashboard item renders in the active style and is a link to `/`

#### Scenario: unbuilt sections do not navigate
- **WHEN** any of the seven unbuilt items is clicked
- **THEN** the URL does not change
- **AND** that item renders no anchor element, carries `aria-disabled="true"`, and shows a `Soon` badge

---

### Requirement: sidebar footer user block [req-4]
The sidebar footer SHALL identify the signed-in user and SHALL be the only place the app offers sign-out.

#### Scenario: identity on the footer row
- **WHEN** a signed-in user views any `(app)` page
- **THEN** the footer shows an avatar with the user's initials, the user's name, and their role

#### Scenario: menu holds the e-mail
- **WHEN** the footer row is activated
- **THEN** a menu opens showing the user's name and e-mail address and a `Sign out` action

#### Scenario: signing out
- **WHEN** `Sign out` is activated
- **THEN** the logout request is sent, the auth store is cleared, and the browser is redirected to `/login`

#### Scenario: the old chip is gone
- **WHEN** the app is built
- **THEN** `components/auth/user-chip.tsx` no longer exists and nothing imports it

---

### Requirement: mobile navigation [req-5]
Below 768px the app SHALL replace the sidebar with a top bar whose control opens the same navigation as a drawer.

#### Scenario: no sidebar on a narrow viewport
- **WHEN** the viewport is narrower than 768px
- **THEN** no persistent sidebar is rendered, and a top bar with a menu control is shown instead

#### Scenario: opening and closing the drawer
- **WHEN** the menu control is activated
- **THEN** a drawer opens over a scrim listing the same eight items in the same three groups
- **AND** it closes on a scrim click, on its close control, and on `Escape`

#### Scenario: no bottom tab bar
- **WHEN** any `(app)` page is viewed below 768px
- **THEN** no bottom tab bar is rendered

---

### Requirement: dashboard screen [req-6]
The route `/` SHALL render a dashboard built from the approved mockup, using static sample data, and the Next.js starter scaffold SHALL be gone.

#### Scenario: dashboard regions
- **WHEN** a signed-in user opens `/`
- **THEN** a greeting naming the user, four stat cards (Total Projects, Meetings, Requirements, Open Questions), a `Recent Projects` list of three projects, and a `Next Meeting` card all render

#### Scenario: scaffold removed
- **WHEN** `/` is opened
- **THEN** no Next.js or Vercel starter content renders anywhere on the page

#### Scenario: greeting varies by time of day
- **WHEN** the page renders
- **THEN** the greeting reads "Good morning", "Good afternoon" or "Good evening" according to the client clock, followed by the user's name

#### Scenario: inert controls stay inert
- **WHEN** `View all`, `View details`, a project row chevron or the notification bell is clicked
- **THEN** the URL does not change and no request is sent

---

### Requirement: dashboard states [req-7]
The dashboard SHALL render a distinct loading, empty and error state, and an error SHALL NOT remove the surrounding shell.

#### Scenario: loading
- **WHEN** the dashboard renders while the session is unresolved
- **THEN** the stat cards, both content cards and the footer user block render as skeleton placeholders

#### Scenario: empty
- **WHEN** there are no projects and no scheduled meeting
- **THEN** the four stat cards show `0`, and each content card shows its own empty message instead of rows

#### Scenario: error
- **WHEN** the dashboard data fails to load
- **THEN** the sidebar and top bar still render
- **AND** the content region shows an error message with a `Retry` control

---

### Requirement: styling fidelity [req-8]
The shell SHALL use only the design tokens already defined in `globals.css`, and SHALL match the approved mockup in both themes.

#### Scenario: no new tokens, no raw colour
- **WHEN** the change is reviewed
- **THEN** `globals.css` defines no token it did not define before
- **AND** no component introduced by this change contains a raw hex colour or a `bg-white`/`bg-black` utility

#### Scenario: sidebar floats above the canvas
- **WHEN** the shell renders at 1280px
- **THEN** the sidebar renders as a rounded, bordered, shadowed card inset from the viewport edge
- **AND** the page content behind it has no competing panel border or radius

#### Scenario: dark theme
- **WHEN** the document carries the `dark` class
- **THEN** the shell renders with the dark sidebar tokens and remains legible, with no element left on a light background

#### Scenario: no horizontal scroll
- **WHEN** the app is viewed at 390px, 768px and 1280px
- **THEN** the page does not scroll horizontally at any of those widths
