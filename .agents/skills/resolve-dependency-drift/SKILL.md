---
name: resolve-dependency-drift
description: Resolve a dependency detector issue for a toolchain or container image.
disable-model-invocation: true
---

# Resolve Dependency Drift

Recommend changes for assessments. Apply requested changes locally and report
completed checks and checks still needed. Leave branch publication, PRs, and
ticket updates to a separate user-directed workflow.

## Workflow

1. Read the detector issue's maintenance unit, current and available state,
   and completion checklist. Find the unit in the repository's dependency
   maintenance configuration and read its update guidance.
2. For containers, hand the maintenance unit, issue, detector candidate, and
   any requested finding scope to `$update-container-image`. Require its
   recommendation, gate and runtime results for the candidate and any test
   build, and any outstanding adoption decision. Require a complete finding
   report for the requested scope, or Critical and High by default. Say when
   evidence is missing or inconclusive.
   Continue at **Confirm resolution** after it returns. For toolchains,
   continue below.

## Update a toolchain

1. Create one isolated directory with
   `mktemp -d /tmp/resolve-dependency-drift.XXXXXX`.
2. Start a background agent with `$research`.
   - For npm, research compatibility, lifecycle-script policy, install paths,
     and verification using primary npm and Node sources.
   - For a release toolchain, research the supported release,
     action compatibility, release assets, published digests, and every
     synchronized installer and CI surface using primary project sources.
   - Override `$research` output handling for this invocation: write its single
     Markdown result inside the exact temporary directory, never in the
     repository.
3. Continue repository discovery while research runs. Read and apply the
   temporary findings before choosing the target or editing.
4. Apply the policy for the issue's maintenance unit:
   - **npm toolchain:** Adopt one exact reviewed npm version across every
     install path. Update the repository's canonical npm declaration.
     Preserve pinned script approvals, explicit denials, fail-closed lifecycle
     policy, and LTS Node compatibility.
   - **Release toolchain:** Synchronize installer and CI versions, supported
     architecture checksums, and action pins. Preserve compatibility, immutable
     identities, and alignment coverage.
5. Update focused tests, generated locks or configuration, the maintenance
   coverage invariant, and affected operator, developer, or CI documentation.
6. Run the repository's relevant verification:
   - For npm, include clean installs, pending script approval checks, audits,
     and nested package checks.
   - For a release toolchain, include checks for drift, alignment, and affected
     CI and installer surfaces.
7. Remove only the temporary directory created for this run after applying its
   findings.

## Confirm resolution

Run the detector's read-only check and report any remaining drift. Use the
repository's documented entry point or exported lookup functions
when the detector CLI also writes issues. Keep detector reconciliation
separate from remediation ticket closure.

For a container, lead the final chat reply with the recommended remediation
and why, the gate and runtime results for the candidate and any test build,
and the decision needed. State whether an exception is needed and give the
next check. Report the detector result, scanner totals, and checks still
needed. Link the complete finding report and retained evidence. Include the
detailed entries in chat when requested, using the remediation handoff's
fields and order.

Before sending, match the linked report against the reviewed checklist by
image, advisory, and affected package copy. When the user requests the full
report in chat, check the reply for the same entries.

If a recommended change still needs approval, name the change and ask the
user directly whether to apply it. Wait for that decision before adopting it.

## Guardrails

- Discover surfaces dynamically; do not rely on an issue file inventory.
- Change only the maintenance unit named by the issue.
- Resolve compatibility work instead of evading the available supported
  release.
- Never use floating versions for project-bound npm dependencies or the
  canonical npm toolchain.
- Preserve the repository's verified rolling channels for standalone tools.
- Keep explicit lifecycle-script approvals limited to reviewed dependencies.
