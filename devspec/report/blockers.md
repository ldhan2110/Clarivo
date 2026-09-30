## add-login · 9. End-to-end proof · 2026-09-30T10:14:00Z
what: Section 9's `Verify: cd backend && pnpm test:e2e` exits non-zero, so the
  section cannot be marked satisfied — even though all four tests this change
  added (`backend/test/auth.e2e-spec.ts`) pass.
tried: No Impact Area default covers it, and it is none of the four hard-block
  cases. The failing test is `backend/test/auth.e2e-spec.ts`'s neighbour
  `backend/test/app.e2e-spec.ts`, which asserts `GET /` returns "Hello World!"
  from an `AppController`. No such controller exists in this repo —
  `src/app.module.ts` declared no `controllers` before this change touched it,
  so the test was already failing when the run started. It is unrelated to
  add-login, and CLAUDE.md says to mention unrelated dead code rather than
  delete it, so the worker did not remove or edit it, and did not edit the
  Verify line to pass around it.
needs: A human decision on the pre-existing test — delete `test/app.e2e-spec.ts`
  as dead (the controller it tests is gone), or restore an `AppController`.
  Then reset `tasks.yml` status blocked -> pending and re-run.
  Everything else in the change is built and verified; see
  devspec/changes/add-login/verify/fixes.md.
status: open
