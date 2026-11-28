---
name: resolve-dependency-drift
description: Resolve a dependency detector issue for a toolchain or container image.
disable-model-invocation: true
---

# Resolve Dependency Drift

Recommend changes for assessments. Apply requested changes locally and report
completed and pending checks. Leave branch publication, PRs, and ticket
updates to a separate user-directed workflow.

## Workflow

1. Read the detector issue's maintenance unit, current and available state,
   and completion checklist. Find the unit in the repository's dependency
   maintenance configuration and read its update guidance.
2. For containers, hand the maintenance unit, issue, and detector candidate
   to `$update-container-image`. Require its verification handoff to include
   the gate decision and a recommendation or concrete next check for every
   distinct High or Critical finding across scanners. Report any unfinished
   assessment as pending. Continue at **Confirm resolution** after it
   returns. For toolchains, continue below.

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

Run the detector's read-only check and confirm the unit reports no remaining
drift. Use the repository's documented entry point or exported lookup functions
when the detector CLI also writes issues. For a container, report the detector
result alongside the gate decision, completed recommendations, and any
pending verification. Keep detector reconciliation separate from remediation
ticket closure.

## Guardrails

- Discover surfaces dynamically; do not rely on an issue file inventory.
- Change only the maintenance unit named by the issue.
- Resolve compatibility work instead of evading the available supported
  release.
- Never use floating versions for project-bound npm dependencies or the
  canonical npm toolchain.
- Preserve the repository's verified rolling channels for standalone tools.
- Keep explicit lifecycle-script approvals limited to reviewed dependencies.
