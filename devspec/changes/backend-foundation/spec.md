# Spec: backend-foundation

### Requirement: environment validation at startup [req-1]
The application SHALL validate every required environment variable before accepting traffic, and SHALL refuse to start when any variable is missing or malformed.

#### Scenario: required variable missing
- **WHEN** the process starts with `DATABASE_PASSWORD` unset
- **THEN** it exits with a non-zero code
- **AND** stderr names `DATABASE_PASSWORD` and the constraint it failed
- **AND** no HTTP listener is opened

#### Scenario: variable present but malformed
- **WHEN** the process starts with `PORT=not-a-number`
- **THEN** it exits with a non-zero code naming `PORT`

#### Scenario: every offender reported at once
- **WHEN** the process starts with two required variables unset
- **THEN** the failure output names both, not only the first

#### Scenario: valid environment
- **WHEN** the process starts with a complete, well-formed environment
- **THEN** it boots and the validated values are readable through `ConfigService`

#### Scenario: optional variable defaults
- **WHEN** `PORT` and `NODE_ENV` are unset but all required variables are present
- **THEN** it boots with `PORT` 3000 and `NODE_ENV` `development`

### Requirement: database connection from validated config [req-2]
The application SHALL connect to PostgreSQL using only validated configuration, and SHALL never synchronize schema automatically.

#### Scenario: connection established
- **WHEN** the application boots against a reachable Postgres instance
- **THEN** the TypeORM `DataSource` reports initialized
- **AND** `SELECT 1` succeeds through it

#### Scenario: synchronize is off
- **WHEN** the resolved TypeORM options are inspected in any environment
- **THEN** `synchronize` is `false`

#### Scenario: configuration is not read from process.env at call sites
- **WHEN** the database options factory is invoked
- **THEN** it obtains every value from `ConfigService`

#### Scenario: unreachable database
- **WHEN** the application boots with `DATABASE_HOST` pointing at no listener
- **THEN** startup fails with a connection error rather than starting without a database

### Requirement: migration-only schema changes [req-3]
Schema changes SHALL be applied exclusively through versioned migration files generated as TypeScript, runnable without a TypeScript loader.

#### Scenario: migrations apply to an empty database
- **WHEN** the migration run command executes against a database with no tables
- **THEN** it completes successfully
- **AND** the `migrations` table records each applied migration

#### Scenario: generation emits TypeScript into source
- **WHEN** a migration is generated after an entity change
- **THEN** a `.ts` file appears under `src/database/migrations/`
- **AND** no `.js` migration is written to the source tree

#### Scenario: re-running is a no-op
- **WHEN** the migration run command executes twice in a row
- **THEN** the second run applies nothing and exits successfully

#### Scenario: revert undoes the last migration
- **WHEN** the migration revert command runs after a successful migration
- **THEN** that migration's `down` executes and its row leaves the `migrations` table

### Requirement: shared base entity [req-4]
Every persisted entity SHALL inherit a time-ordered uuid primary key, audit columns, and a soft-delete column from one abstract base class.

#### Scenario: primary key assigned by the database
- **WHEN** a row is inserted without supplying an id
- **THEN** the database assigns a uuid whose version nibble is 7

#### Scenario: keys are time-ordered
- **WHEN** two rows are inserted in sequence
- **THEN** the second row's id sorts lexicographically after the first

#### Scenario: timestamps maintained automatically
- **WHEN** a row is inserted and later updated
- **THEN** `created_at` is unchanged by the update
- **AND** `updated_at` reflects the update

#### Scenario: soft delete hides the row but retains it
- **WHEN** a row is soft-removed
- **THEN** `deleted_at` is set
- **AND** a default find excludes it
- **AND** a find with `withDeleted: true` returns it

#### Scenario: audit-user columns are nullable and unconstrained
- **WHEN** a row is inserted without `created_by` or `updated_by`
- **THEN** the insert succeeds with both null
- **AND** neither column carries a foreign key constraint

#### Scenario: columns are snake_case in the database
- **WHEN** the generated table is inspected
- **THEN** the columns are `created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`
- **AND** the entity exposes them as camelCase properties

### Requirement: pagination contract [req-5]
List endpoints SHALL accept a shared, bounded pagination query, and paginated responses SHALL carry items alongside navigation metadata.

#### Scenario: numeric strings coerced
- **WHEN** a request supplies `?page=2&limit=10`
- **THEN** the DTO exposes `page` and `limit` as numbers

#### Scenario: defaults applied when omitted
- **WHEN** a request supplies no pagination parameters
- **THEN** `page` is 1 and `limit` is 20

#### Scenario: limit above the maximum rejected
- **WHEN** a request supplies `?limit=1000`
- **THEN** the response is 400
- **AND** the limit is not silently clamped

#### Scenario: page below the minimum rejected
- **WHEN** a request supplies `?page=0`
- **THEN** the response is 400

#### Scenario: invalid sort direction rejected
- **WHEN** a request supplies `?order=sideways`
- **THEN** the response is 400

#### Scenario: sort direction normalized
- **WHEN** a request supplies `?order=asc`
- **THEN** the DTO exposes `order` as `ASC`

#### Scenario: response metadata computed
- **WHEN** a paginated response is built for page 2 of 25 total records at limit 10
- **THEN** it reports `page` 2, `limit` 10, `total` 25, `totalPages` 3, `hasNext` true, `hasPrev` true

### Requirement: request validation at the trust boundary [req-6]
The application SHALL validate and strip every incoming request body against its declared DTO, rejecting unknown properties.

#### Scenario: unknown property rejected
- **WHEN** a request body carries a property the DTO does not declare
- **THEN** the response is 400
- **AND** the message names the offending property

#### Scenario: wrong type rejected
- **WHEN** a request body carries a declared property of the wrong type
- **THEN** the response is 400

#### Scenario: valid body proceeds
- **WHEN** a request body satisfies its DTO
- **THEN** the handler receives an instance of the DTO class

#### Scenario: no implicit coercion
- **WHEN** a string is supplied for a numeric field that lacks an explicit transform
- **THEN** the response is 400 rather than a silently coerced value

### Requirement: uniform error envelope [req-7]
Every failed request SHALL return one documented error envelope, and database driver internals SHALL never appear in a response body.

#### Scenario: unmatched route
- **WHEN** a request hits a path with no handler
- **THEN** the response is 404 carrying `statusCode`, `code`, `message`, `path`, and `timestamp`

#### Scenario: thrown HTTP exception preserved
- **WHEN** a handler throws a Nest `HttpException` with status 403
- **THEN** the response is 403 in the envelope shape, preserving the thrown message

#### Scenario: unique violation mapped
- **WHEN** a write violates a unique constraint (Postgres `23505`)
- **THEN** the response is 409 with `code` `CONFLICT`

#### Scenario: foreign key violation mapped
- **WHEN** a write violates a foreign key constraint (Postgres `23503`)
- **THEN** the response is 409 with `code` `CONFLICT`

#### Scenario: malformed uuid mapped
- **WHEN** a query receives an invalid uuid causing Postgres `22P02`
- **THEN** the response is 400

#### Scenario: unexpected failure does not leak driver detail
- **WHEN** a handler throws a non-HTTP error
- **THEN** the response is 500 with `code` `INTERNAL_ERROR` and a generic message
- **AND** the response body contains no driver text, SQL, or stack trace
- **AND** the full cause is written to the logger

### Requirement: reproducible container build and local database [req-8]
The repository SHALL provide a runnable local PostgreSQL 18 service and a reproducible container image of the backend.

#### Scenario: database service starts healthy
- **WHEN** the Compose stack is brought up
- **THEN** a PostgreSQL 18 service reports healthy
- **AND** it is reachable on host port 5433

#### Scenario: database state survives a restart
- **WHEN** the database service is stopped and started again
- **THEN** previously applied migrations are still recorded

#### Scenario: image builds and serves
- **WHEN** the backend image is built from the repository
- **THEN** the build succeeds
- **AND** a container from it starts and answers an HTTP request

#### Scenario: image excludes build-time material
- **WHEN** the built image is inspected
- **THEN** it contains no `node_modules` devDependencies and no TypeScript source

#### Scenario: container runs unprivileged
- **WHEN** a container from the image is inspected
- **THEN** its process runs as a non-root user

#### Scenario: migrations are not run automatically at boot
- **WHEN** a container from the image starts normally
- **THEN** it does not execute migrations as part of startup
