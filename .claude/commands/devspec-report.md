---
name: "DevSpec: Report"
description: Render the whole devspec board + run history into one accumulating report.html and open it in the browser
category: Workflow
tags: [workflow, report, html]
---

Invoke the `devspec-report` skill. Input: `$ARGUMENTS` (none required; renders the whole board + run history into `devspec/report/report.html` and opens it). Pass `no-open` to generate-only — render and print the path, skip the browser (what the unattended worker uses).
