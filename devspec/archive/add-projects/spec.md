# Spec: add-projects

Behaviour contract. `design.md` holds the rationale and the Decision Defaults, `db.md` the live
schema, `ui.md` the approved screens. Error codes below are the `defineErrors('PROJECT', …)`
codes from `design.md` Default 4; every failure response carries the repo's one envelope
(`{statusCode, code, message, details?, path, timestamp}`).

Throughout: **viewer** = the authenticated user resolved from the `clv_at` session cookie.
Every endpoint in this change is behind `JwtAuthGuard`, so an unauthenticated request is a 401
before any requirement below applies.

---

### Requirement: projects and project_members schema [req-1]
The database SHALL gain a `projects` table and a `project_members` table through one additive
migration, matching `db.md` column for column, with no change to any existing table.

#### Scenario: migration applies
- **WHEN** `pnpm migration:run` is executed against a database at the previous migration
- **THEN** `projects` and `project_members` exist with the columns, types, nullability and
  defaults listed in `db.md`
- **AND** `projects.code` carries a UNIQUE constraint
- **AND** `projects.status` carries `CHECK (status IN ('active','archived'))` and defaults to `'active'`
- **AND** `project_members.role` carries `CHECK (role IN ('owner','member'))`
- **AND** `project_members` carries a composite UNIQUE on `(project_id, user_id)` and an index on `(user_id)`
- **AND** `project_members.project_id` is `ON DELETE CASCADE` while `project_members.user_id` and
  `projects.created_by` are `ON DELETE RESTRICT`

#### Scenario: migration reverts
- **WHEN** `pnpm migration:revert` is executed immediately after
- **THEN** both tables are dropped in foreign-key order and no other table is altered
- **AND** `pnpm migration:run` applies cleanly a second time

#### Scenario: columns are snake_case
- **WHEN** the entity decorator metadata for `Project` and `ProjectMember` is read
- **THEN** every column declares an explicit snake_case `name:` — no naming strategy is configured,
  so a forgotten `name:` would ship a camelCase column

#### Scenario: existing tables untouched
- **WHEN** the migration has run
- **THEN** `users` and `files` have the same columns, constraints and row counts as before

---

### Requirement: create a project [req-2]
The API SHALL create a project from `POST /projects`, make the creator its owner in the same
transaction, and reject a duplicate code or an inverted date range.

#### Scenario: valid create
- **WHEN** the viewer posts `code`, `name`, `customerBu`, `domain` and optionally `objective`,
  `startsOn`, `endsOn`
- **THEN** the API returns 201 with a `ProjectDto` whose `status` is `active` and `viewerRole` is `owner`
- **AND** a `project_members` row exists for the viewer with `role='owner'`
- **AND** `startsOn` / `endsOn` are serialised as `'YYYY-MM-DD'` strings, not timestamps

#### Scenario: a missing required field
- **WHEN** `code`, `name`, `customerBu` or `domain` is absent or empty
- **THEN** the API returns 400 naming the offending field in `details`

#### Scenario: an undeclared field
- **WHEN** the body carries a field the DTO does not declare
- **THEN** the API returns 400 — `forbidNonWhitelisted` is on globally and stays on

#### Scenario: duplicate code
- **WHEN** the posted `code` already belongs to any project, including one the viewer cannot see
- **THEN** the API returns 409 `PROJECT_CODE_TAKEN`

#### Scenario: end date before start date
- **WHEN** `endsOn` is earlier than `startsOn`
- **THEN** the API returns 400 `PROJECT_INVALID_DATE_RANGE`

#### Scenario: creation is atomic
- **WHEN** writing the membership row fails
- **THEN** the `projects` row is rolled back and no orphan project exists

---

### Requirement: list the viewer's projects [req-3]
The API SHALL return from `GET /projects` only projects the viewer owns or is a member of,
paginated, searchable and status-filtered.

#### Scenario: membership scoping
- **WHEN** the viewer lists projects
- **THEN** every returned row is one the viewer has a `project_members` row for
- **AND** a project the viewer is not a member of never appears, under any filter or search term

#### Scenario: default paging and sort
- **WHEN** no `pagination` or `sort` is supplied
- **THEN** the API returns at most 20 rows ordered by `updatedAt DESC`
- **AND** the response carries `items`, `total`, `page` and `limit`, where `total` counts matching
  rows before paging

#### Scenario: paging walks
- **WHEN** the viewer requests `?pagination[page]=2&pagination[limit]=1` with at least two projects
- **THEN** the returned row differs from page 1 and `total` is unchanged

#### Scenario: search
- **WHEN** `?q=<term>` is supplied
- **THEN** only rows whose `code` or `name` contains the term case-insensitively are returned

#### Scenario: status filter
- **WHEN** `?status=active` (the default) is supplied
- **THEN** archived projects are excluded
- **AND** `?status=archived` returns only archived ones, `?status=all` returns both

#### Scenario: an unsupported sort field
- **WHEN** `?sort[sortBy]=password_hash` is supplied
- **THEN** the API returns 400 — `sortBy` is whitelisted, so no arbitrary column reaches the `ORDER BY`

#### Scenario: row shape
- **WHEN** a row is returned
- **THEN** it carries `memberCount`, at most three `memberNames` for the avatar stack, and the
  viewer's `viewerRole`
- **AND** it carries no `createdBy` uuid — the field has no `@Expose()`

---

### Requirement: read one project [req-4]
The API SHALL return a project from `GET /projects/:id` to its members only, and SHALL be
indistinguishable from an unknown id for everybody else.

#### Scenario: a member reads it
- **WHEN** a member or the owner requests the project
- **THEN** the API returns 200 with `code`, `name`, `customerBu`, `domain`, `objective`, `status`,
  `startsOn`, `endsOn`, `memberCount`, `createdByName` and `viewerRole`

#### Scenario: a non-member reads it
- **WHEN** a user with no membership row requests a project that exists
- **THEN** the API returns 404 `PROJECT_NOT_FOUND`, byte-identical to the response for a random uuid

#### Scenario: a malformed id
- **WHEN** the id is not a uuid
- **THEN** the API returns 400 from `ParseUUIDPipe`

---

### Requirement: update project details [req-5]
The API SHALL let the **owner** update a project's details from `PATCH /projects/:id`, under the
same validation as create.

#### Scenario: the owner updates
- **WHEN** the owner sends a partial body
- **THEN** the API returns 200 with the updated project and `updatedAt` moved forward
- **AND** fields absent from the body are unchanged

#### Scenario: a member tries to update
- **WHEN** a non-owner member sends the same request
- **THEN** the API returns 403 `PROJECT_NOT_OWNER` and nothing is written

#### Scenario: a non-member tries to update
- **WHEN** a non-member sends the same request
- **THEN** the API returns 404 `PROJECT_NOT_FOUND`

#### Scenario: updating an archived project
- **WHEN** the owner updates a project whose status is `archived`
- **THEN** the API returns 409 `PROJECT_ARCHIVED` and nothing is written

#### Scenario: taking another project's code
- **WHEN** the owner sets `code` to one another project already uses
- **THEN** the API returns 409 `PROJECT_CODE_TAKEN`

---

### Requirement: archive and restore [req-6]
The API SHALL move a project between `active` and `archived` through dedicated endpoints, owner
only, and SHALL never hard-delete a project.

#### Scenario: the owner archives
- **WHEN** the owner posts to `/projects/:id/archive`
- **THEN** the API returns 200 with `status: 'archived'`
- **AND** the project disappears from the default `active` list and appears under `?status=archived`
- **AND** the row still exists in the database

#### Scenario: the owner restores
- **WHEN** the owner posts to `/projects/:id/restore`
- **THEN** the API returns 200 with `status: 'active'`

#### Scenario: archiving twice
- **WHEN** the owner archives an already-archived project
- **THEN** the API returns 200 with the project unchanged — the operation is idempotent

#### Scenario: a member tries to archive
- **WHEN** a non-owner member posts to either endpoint
- **THEN** the API returns 403 `PROJECT_NOT_OWNER`

#### Scenario: no delete exists
- **WHEN** the controller's routes are enumerated
- **THEN** no route deletes a project, and `ProjectsService` exposes no project-delete method

---

### Requirement: manage members [req-7]
The API SHALL list a project's members to any member, and SHALL let the **owner** add an existing
account by email and remove a non-owner member.

#### Scenario: a member lists members
- **WHEN** a member requests `GET /projects/:id/members`
- **THEN** the API returns each member's `userId`, `name`, `email` and `role`

#### Scenario: the owner adds by email
- **WHEN** the owner posts an email belonging to an existing Clarivo account
- **THEN** the API returns 201 with the new member row at `role='member'`
- **AND** `memberCount` on the project increases by one
- **AND** no email is sent and no invitation record is created

#### Scenario: an email with no account
- **WHEN** the owner posts an address no account uses
- **THEN** the API returns 404 `PROJECT_MEMBER_NOT_FOUND` — not a pending invitation

#### Scenario: adding an existing member
- **WHEN** the owner posts the email of somebody already on the project
- **THEN** the API returns 409 `PROJECT_ALREADY_MEMBER` and no duplicate row is written

#### Scenario: email case
- **WHEN** the owner posts the same address with different capitalisation
- **THEN** it resolves to the same account — emails are normalised on the way in

#### Scenario: the owner removes a member
- **WHEN** the owner deletes `/projects/:id/members/:userId` for a non-owner member
- **THEN** the API returns 204 and that user can no longer read the project (404 thereafter)

#### Scenario: removing the owner
- **WHEN** anybody attempts to remove the owner's membership row
- **THEN** the API returns 409 `PROJECT_OWNER_NOT_REMOVABLE`

#### Scenario: a member tries to add or remove
- **WHEN** a non-owner member calls either write
- **THEN** the API returns 403 `PROJECT_NOT_OWNER`

#### Scenario: member writes on an archived project
- **WHEN** the owner adds or removes a member on an archived project
- **THEN** the API returns 409 `PROJECT_ARCHIVED`

---

### Requirement: projects list screen [req-8]
The frontend SHALL render `/projects` as the approved `mockups/projects-list.html`: a searchable,
status-filtered, paginated table built from existing components, with two distinct empty states.

#### Scenario: filled list
- **WHEN** the viewer opens `/projects` with projects present
- **THEN** the table shows Project (mark, name, code), Customer / BU, Domain, Members as an avatar
  stack with `+N` overflow, Status, Updated, and a row menu
- **AND** the rendered table is the project's `components/ui/table.tsx`, not a browser-default table

#### Scenario: pagination walks
- **WHEN** more than one page of projects exists and the viewer clicks page 2
- **THEN** different rows render and the range label updates

#### Scenario: search drives the query
- **WHEN** the viewer types a term
- **THEN** the request is debounced and re-issued server-side — the list is not filtered client-side

#### Scenario: no projects at all
- **WHEN** the viewer has no projects
- **THEN** the screen shows "No projects yet" with a `＋ New project` call to action and a disabled search

#### Scenario: nothing matched
- **WHEN** a search or filter matches nothing
- **THEN** the screen shows "No projects match …" with `Clear filters` and **no** create call to action

#### Scenario: row menu permissions
- **WHEN** the row menu is opened
- **THEN** `Open` is always available, `Archive` shows for an active project and `Restore` for an
  archived one, both disabled for a non-owner
- **AND** no `Delete` action appears anywhere on the screen

#### Scenario: load failure
- **WHEN** the list request fails
- **THEN** the screen shows the "Couldn't load your projects" card with `Retry`, in the same shape
  as the existing dashboard error card

---

### Requirement: create project modal [req-9]
The frontend SHALL create a project through one dialog over `/projects`, keeping a filled form
intact on failure and reporting field-level errors on the field.

#### Scenario: the happy path
- **WHEN** the viewer fills the four required fields and submits
- **THEN** the dialog closes, a success toast fires, the list refetches and the new project appears

#### Scenario: required fields gate the button
- **WHEN** any of code, name, customer / BU or domain is empty
- **THEN** `Create` is disabled

#### Scenario: submitting
- **WHEN** the request is in flight
- **THEN** every field and `Cancel` are disabled and the primary button shows a spinner

#### Scenario: duplicate code
- **WHEN** the API answers 409 `PROJECT_CODE_TAKEN`
- **THEN** "A project with this code already exists." renders under the code input, not as a toast

#### Scenario: bad date range
- **WHEN** the end date precedes the start date
- **THEN** the error renders on the end-date field

#### Scenario: the request fails
- **WHEN** the API answers 500
- **THEN** the dialog stays open with every typed value intact and a banner inside the dialog

---

### Requirement: project overview screen [req-10]
The frontend SHALL render `/projects/:id` as the approved `mockups/project-detail.html`: the
four-stage project plan with honest zeros, a summary card, and owner / member / archived /
not-found states.

#### Scenario: the owner's view
- **WHEN** the owner opens the project
- **THEN** the header shows code, name, status badge, an `Owner` badge and a `⚙ Settings` button
- **AND** four stat tiles and the four-stage plan card render, each stage reading `0` with a `Soon` badge
- **AND** the summary card shows objective, customer / BU, domain, timeline, member count, creator
  and last-updated

#### Scenario: a member's view
- **WHEN** a non-owner member opens the project
- **THEN** a `Member` badge renders and neither the `⚙ Settings` button nor the sidebar `Settings`
  row is present

#### Scenario: archived
- **WHEN** the project is archived
- **THEN** a warning ribbon offers `Restore`, the plan card is frozen reading "Stopped at stage N",
  and the project mark is muted

#### Scenario: not found
- **WHEN** the project does not exist, the viewer is not a member, or the id is malformed
- **THEN** the same "Project not found" screen renders with `← Back to projects`, and the sidebar
  stays in global scope

#### Scenario: the counts are not invented
- **WHEN** the page renders
- **THEN** every stage count is a literal `0` carrying a `Soon` marker, and no percentage, health
  ring or Known / Unknown / Conflicts counter appears

---

### Requirement: project-scoped navigation [req-11]
The sidebar SHALL switch to a project scope inside `/projects/:id/*` and back to the global scope
outside it, with desktop and mobile still rendering from one source.

#### Scenario: entering a project
- **WHEN** the viewer opens `/projects/:id`
- **THEN** the sidebar shows `← All projects`, a static project label, and the groups Plan / Run /
  Output / Project
- **AND** `Overview` is the only enabled Plan row; Context, Discovery Plan, Meetings, Requirements,
  Questions and Decisions render disabled with a `Soon` badge

#### Scenario: leaving a project
- **WHEN** the viewer clicks `← All projects`
- **THEN** the sidebar returns to Workspace / Account with Dashboard and Projects enabled

#### Scenario: the Projects row is live
- **WHEN** the global sidebar renders
- **THEN** `Projects` is an enabled link to `/projects` with no `Soon` badge
- **AND** the former global Meetings, Requirements, Questions, Decisions and Documents rows are gone

#### Scenario: one source, two renderers
- **WHEN** the mobile drawer is opened at the same route
- **THEN** it shows the same scope, groups and rows as the desktop sidebar

#### Scenario: owner-only settings row
- **WHEN** a non-owner member is inside a project
- **THEN** the `Project / Settings` row is absent

#### Scenario: scope while loading
- **WHEN** the project detail request is still in flight
- **THEN** the sidebar is already in project scope with a skeleton label — the global nav never flashes

---

### Requirement: project settings screen [req-12]
The frontend SHALL render `/projects/:id/settings` as the approved `mockups/project-settings.html`
for the owner only: details, members and a danger zone.

#### Scenario: details editing
- **WHEN** the owner changes a field
- **THEN** an `Unsaved changes` badge appears and `Save changes` enables; `Discard` restores the
  saved values
- **AND** saving shows a success toast and the header reflects a changed name

#### Scenario: save validation
- **WHEN** the owner saves a code another project uses
- **THEN** the error renders under the code field, matching the create modal's behaviour

#### Scenario: adding a member
- **WHEN** the owner submits an email
- **THEN** the member list grows by one row showing avatar, name, email and a `Member` badge
- **AND** an unknown address renders "No Clarivo account uses this email address." under the input,
  and an existing member renders "<Name> is already a member of this project." — neither as a toast

#### Scenario: removing a member
- **WHEN** the owner clicks `✕` on a member row
- **THEN** the `useConfirm` dialog asks with the warning tone and the `ui.md` copy, and on confirm
  the row disappears with a success toast
- **AND** the owner row has no `✕`, and the viewer's own row is marked `You`

#### Scenario: solo project
- **WHEN** the owner is the only member
- **THEN** the list shows one row plus the "You're the only member…" hint

#### Scenario: archive from the danger zone
- **WHEN** the owner clicks `Archive project`
- **THEN** `useConfirm` asks with the warning tone and the `ui.md` copy — which says nothing is
  deleted — and on confirm the page reflects the archived state
- **AND** the archived page offers `Restore project` and renders the details card and member list disabled

#### Scenario: no archive preset reuse
- **WHEN** the confirm copy is read
- **THEN** none of the three confirms uses `constants/confirm.ts:confirmDelete` or claims anything
  is permanently deleted

#### Scenario: a member hits the URL
- **WHEN** a non-owner member opens `/projects/:id/settings`
- **THEN** the shared "Project not found" screen renders

---

### Requirement: dashboard reflects real projects [req-13]
The dashboard SHALL show real project data, drop its demo scaffolding, and keep its remaining
tiles honestly empty.

#### Scenario: real tiles
- **WHEN** the viewer opens `/`
- **THEN** `Total projects` shows the real count of their active projects and `Recent projects`
  lists real rows with customer, domain, member count and updated time, each linking to `/projects/:id`
- **AND** `View all →` navigates to `/projects`

#### Scenario: archived projects are excluded
- **WHEN** the viewer has archived projects
- **THEN** none appears in `Recent projects` and none is counted in `Total projects`

#### Scenario: the scaffolding is gone
- **WHEN** the page renders
- **THEN** the feedback demo card is absent and the Next Meeting card is absent, with
  `Recent projects` taking the full width

#### Scenario: honest zeros
- **WHEN** the remaining three stat tiles render
- **THEN** each reads `0` with a `Soon` marker rather than sample data

#### Scenario: no projects yet
- **WHEN** the viewer has no projects
- **THEN** `Recent projects` shows the list screen's "No projects yet" block with its create call to action

#### Scenario: no orphans left behind
- **WHEN** the change is complete
- **THEN** `constants/dashboard.ts` and `types/dashboard.ts` contain no unused sample constant or type

---

### Requirement: consumers and conventions are updated [req-14]
The change SHALL leave the generated API types, the schema convention document and the test
fixtures consistent with what it shipped.

#### Scenario: generated types
- **WHEN** `pnpm api:types` is run in `frontend/` against the running backend
- **THEN** `frontend/app/types/api/types.gen.ts` contains the project DTOs, and no file under
  `app/types/api/` has been hand-edited

#### Scenario: schema conventions recorded
- **WHEN** `devspec/context/schema.md` is read afterwards
- **THEN** it documents `projects` and `project_members`, and records as established: enums as
  `varchar` + CHECK, the first composite unique constraint, the first `date` columns, and the
  `ON DELETE CASCADE` exception together with the reasoning that keeps RESTRICT the default

#### Scenario: a second test account exists
- **WHEN** `SEED_MEMBER_EMAIL`, `SEED_MEMBER_PASSWORD` and `SEED_MEMBER_NAME` are set and
  `pnpm seed` is run
- **THEN** a second non-admin account exists, the admin account is unchanged, and rerunning the
  seed does not duplicate either
- **AND** with those variables unset the seed still succeeds and the boot still validates —
  they are optional
- **AND** the credentials are recorded in the gitignored `devspec/improve/testing.md`, while
  `.env.example` carries only empty commented rows

#### Scenario: the repo's own gates pass
- **WHEN** the pre-merge checks in `devspec/context/rules.md` are run
- **THEN** `backend/`: `pnpm lint`, `pnpm test`, `pnpm build` all pass, and `frontend/`:
  `pnpm lint` and `pnpm build` pass
- **AND** `backend/test/app.e2e-spec.ts` is untouched — it is the pre-existing failure logged in
  `devspec/report/blockers.md` and is out of scope
