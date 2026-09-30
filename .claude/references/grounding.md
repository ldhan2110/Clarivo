# Grounding: context/ + improve/

Every DevSpec skill works from the same ground truth instead of re-deriving conventions on each change. Two sources, one precedence rule.

## The two packs

- **`devspec/context/`** — code-derived, written by `/devspec-init` (`summary.md`, `conventions.md`, `patterns.md`, `rules.md`, `schema.md`). Overwritten on every `init` re-run — it's a snapshot of what the code *is*. Read the files your task touches; don't re-derive what's already stated.
- **`devspec/improve/`** — human/conversation-derived, written only by `/devspec-improve` (`testing.md`, `gotchas.md`, `decisions.md`, `conventions.md`). Append-only, never overwritten by a scan — facts a code scan can't hold (test accounts, env order traps, settled decisions-with-why, agreed conventions).

## Rules (apply in every skill that reads the packs)

1. **Read before you act.** Skim the files relevant to your task first — the skill names which ones.
2. **`init` is the prerequisite.** No `devspec/context/`? It never ran. Skills that *write* a change (`explore`, `capture`) must run `/devspec-init` first, not optional. Greenfield repo with nothing to scan → init says so, then proceed.
3. **`improve/` wins on conflict.** Where `improve/` and `context/` disagree, `improve/` is an explicit human decision — follow it and note the discrepancy. Never silently contradict a human choice recorded there.
4. **Fit, don't fight.** What you write must follow the conventions/patterns the packs record. A requirement that can't fit an existing rule gets flagged (open question / rejected-approach), never quietly breaks the standard.
