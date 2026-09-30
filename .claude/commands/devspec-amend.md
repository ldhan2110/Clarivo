---
name: "DevSpec: Amend"
description: Amend an existing change after requirements shift — re-spec in place while unbuilt, or spawn a delta change once shipped
category: Workflow
tags: [workflow, amend, spec]
---
Invoke the `devspec-amend` skill. Input: `$ARGUMENTS` (the change id to amend + optionally what changed). Routes by board status: `pending` re-captures in place; `doing`/`blocked` resets to pending + warns, then re-captures; `done` spawns a `<id>-amend-N` delta change that never mutates the shipped spec.
