---
name: devspec-amend
description: Amend an existing change after its requirements shift — re-spec in place while it's unbuilt, or spawn a new delta change once it has shipped. Routes by the change's board status so an amendment never mutates shipped history or races an in-flight worker. Use when a captured/planned/built change needs to change.
license: MIT
compatibility: File-based, no CLI required. Delegates artifact rewriting to devspec-capture (and its db-design/ui-mockup sub-steps); optional code graph to judge coupling for a delta change's depends_on. Falls back to grep/read when absent.
metadata:
  author: devspec
  version: "1.0"
---

Amend a change whose requirements changed after it was captured. **You re-spec and re-route the board — never application code.** The original build isn't rewritten here; amend produces the new spec, then the worker (or a human) reconciles code to it.

The change's **board status decides the path** — always read its entry in `devspec/changes/tasks.yml` first. Ground on `devspec/context/` + `improve/` before re-speccing, same as capture ([grounding.md](../../references/grounding.md)).

## Route by status

### Not on the board / never captured
No `changes.<id>` entry and no `changes/<id>/` dir → this isn't an amendment, it's a new change. Redirect to `/devspec-capture` and stop.

### `pending` — re-capture in place
Not built yet, so overwriting is safe.
1. Invoke `/devspec-capture <id>` to rewrite `design.md` / `spec.md` / `tasks.md` (and `ui.md` via `/devspec-ui-mockup`, `db.md` via `/devspec-db-design`, if the amendment touches UI or the DB) to the new requirement, re-run the `[req-N]` coverage diff, re-render `spec.html`, re-approve. **Capture's approval gate auto-runs `/devspec-plan`** — don't invoke plan yourself; the board entry updates in place (same id, status stays `pending`).
2. **After** capture, append a dated entry to `changes/<id>/proposal.md` under a `## Amendments` heading (create it if missing): **what** changed, **was → now**, **why**. Doing it after the rewrite means capture can't clobber it. This is the audit trail. The worker picks up the new spec next run.

### `doing` / `blocked` — stop the worker, then re-capture in place
The worker may be mid-build on the **old** spec.
1. **Stop the running worker loop first** if one is active. It's unattended — a human intervening halts `run-worker.sh`/`.bat` (or waits for the current change to finish). Editing the board under a live worker races its own board write (last-writer-wins), so a reset made mid-loop can be silently clobbered.
2. In `tasks.yml`, set the entry `status: pending` and clear `owner: ""` — the worker no longer owns it and won't keep advancing a stale spec.
3. **Warn the human.** In-flight code from the old spec may already be committed locally. **Amend does not rewrite that code.** A human (or the next worker pass on the amended `tasks.md`) must reconcile it — revert or adjust work the amendment made obsolete. Flag exactly what looks stale; never leave dead code silently.
4. Then the same in-place re-capture as `pending` above (capture → auto-plan → Amendments log).

### `done` — new delta change, never mutate the shipped spec
The change shipped; its artifacts sit in `archive/<id>/` (or `changes/<id>/` if not yet archived). **Do not touch them** — what shipped stays as it shipped.
1. New id `<id>-amend-<N>` (N = next free integer for that base).
2. Seed `changes/<id>-amend-<N>/proposal.md` referencing the original: `Amends `<id>`` (`archive/<id>/spec.md`) — <what changes and why>. The reference tells `plan` these are coupled.
3. Invoke `/devspec-capture <id>-amend-<N>` for its full artifact set. Capture's approval gate auto-runs `/devspec-plan`, which registers it as a fresh change and judges `depends_on` from real coupling (it'll set `[<id>]` when the delta builds on the original's code — [references/code-graph.md](../../references/code-graph.md); `[]` if independent). Don't call plan or hand-write `depends_on` yourself — plan owns that.
4. The original entry stays `status: done`, untouched. The new id + the proposal reference **are** the audit trail.

## Flow

1. Read the target's board entry and `status`.
2. Route: absent → `/devspec-capture` (new); `pending` → in-place; `doing`/`blocked` → stop the worker loop, reset `pending` + clear `owner` + warn, then in-place; `done` → new `<id>-amend-N` delta change.
3. In-place path: `/devspec-capture <id>` (auto-plans on approval), then append the `## Amendments` log to `proposal.md`.
4. `done` path: seed the delta proposal referencing the original, `/devspec-capture <id>-amend-N` (auto-plans, sets `depends_on` from coupling).
5. Hand off: the amended/new spec is on the board; the worker builds it next run.

## Guardrails

- **Never mutate a `done`/archived spec.** Amendment to shipped work is always a new delta change; the original stays exactly as it shipped.
- **Stop the worker before re-speccing in-flight work.** `doing`/`blocked` → reset `status: pending` + clear `owner` first, and warn that old-spec code needs reconciliation. Amend never rewrites code itself.
- **Audit every amendment.** In-place → a dated `## Amendments` entry (was → now → why). `done` → a new id plus a proposal reference to the original. No silent respec.
- **Markdown + board only.** Amend re-specs and re-routes the board; it writes no application code and runs no migrations — capture/worker own those.
- **Coverage still holds.** After re-capture, every spec req maps to a `tasks.md` section (the `[req-N]` diff). An amendment that drops a req but keeps its task, or adds a req with no task, is drift — fix it before re-plan.
- **One reviewable unit.** If an amendment balloons into a second feature, capture it as its own change, don't smuggle it into the amended spec.
