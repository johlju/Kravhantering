---
name: resolve-dependency-drift
description: >-
  Resolve a dependency drift ticket for a toolchain or container image.
  Assess container scan results, recheck remediation tickets, and verify
  selected fixes or scoped exceptions.
argument-hint: "[drift ticket | remediation ticket | scan or CI evidence]"
disable-model-invocation: true
---

# Resolve Dependency Drift

## Choose the path

- **Drift ticket:** Read its maintenance unit, current and available state,
  and completion checklist. Find the unit in the repository's dependency
  maintenance configuration. Read the [toolchain update](references/toolchain-update.md)
  or [container image update](references/image-update.md) for that unit.
- **Remediation ticket:** [Recheck the ticket](references/remediation.md#recheck-existing-tickets)
  against the relevant upstream image. Assess scan findings when a fix is
  still needed. Read [exception maintenance](references/exceptions.md) for
  a scoped exception review or change.
- **Scan evidence or CI job:** [Assess the scan](references/remediation.md#assess-scanned-findings)
  for the exact image and source commit, whether the gate passes or blocks.

Discover the affected surfaces and change only the requested maintenance unit
or remediation scope. For container work, use the canonical gate supplied by
the caller or declared by the repository. If neither identifies it, find the
likely command or workflow, show it to the user, and wait for confirmation
before using it.

## Verify and decide

- For containers, test available fixes in isolation before presenting a
  decision. Get approval for the exact remediation before changing release
  packaging. For an override, get one
  approval for the record and its tracking ticket using the
  [override criteria](references/exceptions.md#change-the-record). Leave
  branch publication, PRs, and other ticket mutations to a separate workflow.
- Apply selected changes locally. After changing a package or image, use
  [remediation verification](references/remediation.md#verify-and-record).
- For a drift ticket, run the detector's read-only check and report any
  remaining drift. Use the repository's documented entry point or lookup
  functions when its detector also writes issues. Keep detector reconciliation
  separate from remediation ticket closure.

## Deliver the result

For every container path, use this step before sending the final chat reply,
including when the workflow stops for approval.

1. Lead with the recommended remediation and why. Give the gate and runtime
   results for the candidate and any test build separately. Say which
   blockers the change clears or leaves, whether an exception is needed,
   and what to check next. Report the detector result for a drift ticket.
   Say `Evidence is missing or inconclusive` when it prevents a conclusion.
   Mark any production digest unverified unless deployment evidence
   confirms it.
2. Use the [finding report](references/finding-report.md) for scope, field
   order, and scanner totals. Link the complete report and retained evidence
   when available. Include detailed entries in chat when requested. Match
   the report to in-scope findings on the reviewed checklist by image,
   advisory, and affected package copy. If the full report was requested in
   chat, check the reply for those same entries and all five fields in order.
3. When approval is needed, name the exact change and ask the user directly
   whether to apply it. Wait for the decision before adopting it.
4. Before sending, inspect the actual reply. It must contain the recommendation
   and reason, gate and runtime results, exception need, next check, and the
   report link or an explanation of what evidence is missing. Check for the
   approval question when applicable. Repair omissions before sending the reply.
