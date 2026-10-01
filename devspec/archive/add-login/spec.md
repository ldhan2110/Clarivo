# Spec: add-login

### Requirement: user record persistence [req-1]
The system SHALL persist user accounts in a `users` table created by a forward migration, with a unique email and a hashed password that is never returned by the API.

#### Scenario: migration creates the table
- **WHEN** `pnpm migration:run` is executed against a database without the table
- **THEN** a `users` table exists with `id` (uuid, primary key), `email`, `password_hash`, `name`, `created_at` and `updated_at` (both `timestamptz`)
- **AND** a unique index exists on `email`

#### Scenario: duplicate email is rejected
- **WHEN** a second user row is inserted with an email that already exists
- **THEN** the database raises a unique-constraint violation

#### Scenario: the hash never leaves the server
- **WHEN** any endpoint returns a user
- **THEN** the response body contains no `password_hash` field

---

### Requirement: seeded administrator account [req-2]
The system SHALL provide a rerunnable script that creates exactly one administrator account from environment variables, without committing any credential to the repository.

#### Scenario: first run creates the account
- **WHEN** `pnpm seed` runs against a database with no matching user
- **THEN** one row exists with the email from `SEED_ADMIN_EMAIL` and a password hash verifying against `SEED_ADMIN_PASSWORD`

#### Scenario: repeat run does not duplicate
- **WHEN** `pnpm seed` runs a second time
- **THEN** exactly one row still exists for that email

---

### Requirement: credential authentication [req-3]
The API SHALL authenticate a correct email and password by issuing a signed JWT in an httpOnly cookie.

#### Scenario: valid credentials
- **WHEN** `POST /auth/login` receives an email and password matching a stored user
- **THEN** the response is 200 with the user's `id`, `email` and `name`
- **AND** the response sets a `clv_at` cookie marked `HttpOnly`, `SameSite=Lax` and `Path=/`
- **AND** the cookie value is a JWT whose `sub` claim is that user's id

#### Scenario: email case is ignored
- **WHEN** the submitted email differs only in letter case from the stored email
- **THEN** authentication succeeds

#### Scenario: malformed request
- **WHEN** the request body is missing `password`, or carries a field the DTO does not declare
- **THEN** the response is 400 in the standard error envelope

---

### Requirement: credential rejection without account disclosure [req-4]
The API SHALL reject bad credentials with one response that does not reveal whether the email exists.

#### Scenario: wrong password
- **WHEN** `POST /auth/login` receives a known email with the wrong password
- **THEN** the response is 401 with code `AUTH_INVALID_CREDENTIALS`
- **AND** no cookie is set

#### Scenario: unknown email
- **WHEN** `POST /auth/login` receives an email that is not in the table
- **THEN** the response is byte-identical in status, code and message to the wrong-password response

---

### Requirement: session persistence choice [req-5]
The API SHALL keep the session across browser restarts only when the user asked it to.

#### Scenario: remember me checked
- **WHEN** `POST /auth/login` is called with `remember: true` and valid credentials
- **THEN** the `clv_at` cookie carries a `Max-Age` of 30 days

#### Scenario: remember me unchecked
- **WHEN** `POST /auth/login` is called with `remember: false` or with the field omitted
- **THEN** the `clv_at` cookie carries no `Max-Age` and no `Expires`, making it a session cookie

---

### Requirement: current user endpoint [req-6]
The API SHALL identify the signed-in user from the session cookie, and reject requests without a valid one.

#### Scenario: valid session
- **WHEN** `GET /auth/me` is called carrying a valid `clv_at` cookie
- **THEN** the response is 200 with that user's `id`, `email`, `name`, `createdAt` and `updatedAt`

#### Scenario: no cookie
- **WHEN** `GET /auth/me` is called with no `clv_at` cookie
- **THEN** the response is 401

#### Scenario: expired or tampered token
- **WHEN** `GET /auth/me` is called with a `clv_at` cookie whose JWT is expired or fails signature verification
- **THEN** the response is 401

---

### Requirement: session termination [req-7]
The API SHALL end a session on request, so the browser stops sending a usable cookie.

#### Scenario: logout clears the cookie
- **WHEN** `POST /auth/logout` is called
- **THEN** the response is 200 and instructs the browser to clear `clv_at`
- **AND** a subsequent `GET /auth/me` from that browser returns 401

---

### Requirement: cross-origin credentialed access [req-8]
The API SHALL accept credentialed browser requests from the frontend's development origin.

#### Scenario: browser request from the frontend origin
- **WHEN** the frontend, served from its configured dev port, calls `POST /auth/login` with credentials
- **THEN** the response carries `Access-Control-Allow-Credentials: true` and an `Access-Control-Allow-Origin` matching that origin
- **AND** the browser stores the `clv_at` cookie

---

### Requirement: login screen presentation [req-9]
The application SHALL present a login screen at `/login` matching the approved mockup at every supported width.

#### Scenario: phone width
- **WHEN** `/login` is rendered at 390px wide
- **THEN** a single centred card shows the Clarivo logo, the welcome line, the Email and Password fields, a "Remember me" checkbox, a "Forgot password?" link and a "Sign in" button
- **AND** no tagline, feature list or illustration is shown
- **AND** the inputs and the submit button are at least 48px tall and the inputs render at 16px font size

#### Scenario: desktop width
- **WHEN** `/login` is rendered at 1180px wide
- **THEN** the card is split into two panels, the left showing the logo above the login illustration uncropped and centred, the right showing the form

#### Scenario: styled, not default
- **WHEN** the rendered page is inspected
- **THEN** the card, inputs and button carry the project's theme values rather than browser-default styling

---

### Requirement: login screen behaviour [req-10]
The login screen SHALL validate input locally, communicate progress and failure, and navigate away on success.

#### Scenario: local validation blocks submission
- **WHEN** the form is submitted with an empty password or a malformed email
- **THEN** a message appears under the offending field, that field is marked invalid, and no request is sent

#### Scenario: submitting
- **WHEN** a valid form is submitted and the request is in flight
- **THEN** the inputs, the checkbox and the button are disabled and the button shows a progress indicator

#### Scenario: rejected credentials
- **WHEN** the API responds 401
- **THEN** one message, "Incorrect email or password.", appears above the fields, neither field is marked invalid, and the entered values are preserved

#### Scenario: success
- **WHEN** the API responds 200
- **THEN** the browser navigates to `/`

---

### Requirement: protected route redirection [req-11]
The application SHALL send visitors without a session to the login screen, and SHALL NOT redirect the login screen itself.

#### Scenario: unauthenticated visit to a protected route
- **WHEN** `/` is requested with no `clv_at` cookie
- **THEN** the response redirects to `/login`

#### Scenario: login page stays reachable
- **WHEN** `/login` is requested with no `clv_at` cookie
- **THEN** the login page renders with no redirect

#### Scenario: authenticated visit
- **WHEN** `/` is requested carrying a `clv_at` cookie
- **THEN** the page renders without redirecting
