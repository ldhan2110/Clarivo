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

## add-file-storage · 6. Prove it against the running API · 2026-10-01T04:06:30Z
what: `spec.md` [req-3], scenario "on-disk name ignores the uploaded filename",
  asserts that `original_name` stores an uploaded filename **verbatim**. It does
  not, and cannot. Measured with a hand-built raw multipart body (curl sanitises
  `filename=` itself, so it does not test the server): a part declaring
  `filename="../../../etc/passwd.pdf"` yields `originalName = "passwd.pdf"`.
  multer/busboy reduces the filename to its basename before the application sees
  it.
tried: Not one of the four hard-block cases, and no Impact Area default covers a
  wrong factual assertion in the spec. Implementing the clause literally would
  mean hand-parsing raw multipart headers to recover the path the library
  deliberately stripped — strictly worse, and worse for security. The worker does
  not rewrite specs, so the clause was not silently corrected.
  Everything the scenario exists to PROVE passes, and passes twice over:
  `storage_key` was `2026/10/<uuidv7>.pdf` (generated, extension from the
  validated mime type, never from the name), and nothing was written outside
  `FILE_STORAGE_PATH`. The spec is wrong in the safe direction.
needs: A one-clause amendment to `spec.md` [req-3] — `original_name` stores the
  filename multer reports, which is already reduced to a basename. Run
  `/devspec-amend add-file-storage`. No code change follows from it; the
  implementation is already correct and stronger than the spec assumed.
  This did NOT stop the change: every other check in sections 1-7 passes and the
  change is committed. Measured output is in
  devspec/changes/add-file-storage/verify/results.md.
status: open

## add-project-context · 9-10. Live UI verify · 2026-10-02T13:55:00Z
what: Sections 9-10 (frontend Context page, nav, overview count) are built and
  COMPILE-verified — `cd frontend && npx tsc --noEmit`, `pnpm lint`, `pnpm build`
  all clean; the route `/projects/[id]/context` is in the build output; the
  backend boots live with all 7 context routes (hot-reloaded on :3000) and
  `pnpm api:types` regenerated cleanly. The section `Verify:` is
  `/devspec-verify add-project-context`, a LIVE agent-browser run.
tried: The live run was not executed. It needs (a) the frontend dev server on
  :3001 and (b) REAL `AI_API_KEY` + `TAVILY_API_KEY` in `backend/.env` — the
  current values are `change-me` placeholders (added so the process boots). With
  placeholders the page renders (empty/unprocessed states, nav, tiles, Sources
  panel, research dialog open) but the AI path fails, so the devspec-verify
  assertion "a rendered mermaid node is visible (from a real process→summary
  run)" and the research-returns-pages assertion cannot pass. Faking a green was
  declined per the worker's no-fake-verify rule.
needs: A human with real provider keys: set AI_* + TAVILY_API_KEY in
  `backend/.env`, run `cd frontend && pnpm dev` (+ backend on :3000), then
  `/devspec-verify add-project-context`. On green, reset the board
  `status: blocked → done` and re-run the worker (it will commit + archive).
  Everything else in the change is built, unit-tested (backend 172/172) and
  compile-verified.
status: open
