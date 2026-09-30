_approved_by: LE AN_
_approved_at: 2026-09-30_

# Proposal: add-login

## Why

Clarivo has no authentication of any kind. There is no `User` table, no login endpoint, no guard, and no way to tell one person from another. Every screen on the 15-screen MVP board sits behind a signed-in user — the dashboard greets "Good morning, An", projects have a BA and members, meetings have participants. None of that can be built until there is a user to attach it to.

This change is the smallest thing that unblocks the rest: one real account can sign in, stay signed in, and be identified by the API.

## What it delivers

- A `users` table — the first domain table in the repo — plus the first migration this project has ever run.
- One seeded administrator account, created by a rerunnable script from environment variables.
- `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` on the backend, with the session carried in an httpOnly cookie.
- A login screen at `/login` built to the approved mockup, working properly on a phone.
- Unauthenticated visitors are redirected to `/login`.

## Scope

**In**
- Local email + password authentication only.
- A single JWT, signed by the API, delivered as an httpOnly cookie.
- "Remember me" — checked keeps the session for 30 days across browser restarts; unchecked ends it when the browser closes.
- `users` table, `User` entity, forward migration, idempotent seed script.
- Login page: responsive (phone-first), field validation, submitting and error states, redirect on success.
- Route protection via Next.js middleware.
- Two configuration fixes this change cannot work without: the frontend dev port, and the `CORS_ORIGINS` list that currently does not include it.

**Out** — deliberately, each additive later with no migration to undo
- Sign-up / self-registration. There is no sign-up screen in the 15-screen board; accounts are seeded. The "Sign up" link renders but is inert.
- Password reset and the email infrastructure it needs. "Forgot password?" renders but is inert.
- Google and Keycloak SSO. Both appear in the original mockup image and are **cut** — Keycloak is not running anywhere and nothing federates to it today.
- Refresh tokens and rotation. One token, one cookie.
- Token revocation, and therefore forced logout of an existing session.
- Roles and permissions. The board shows a `BA` chip, but that belongs to project membership, not to login.
- Rate limiting and account lockout.

## Accepted ceilings

- **A stolen cookie is valid for up to 30 days.** There is no revocation list and no refresh rotation. Acceptable for an internal tool pre-launch; upgrading to short-lived access + refresh tokens is additive and touches no data.
- **Accounts exist only by seeding.** Adding a user means running the seed script or writing SQL. Fine while the user count is one.
- The dashboard the login redirects to does not exist yet; success lands on the current placeholder home page.
