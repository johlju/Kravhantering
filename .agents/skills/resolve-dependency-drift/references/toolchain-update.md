# Toolchain Update

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

Report the change, the checks that ran, and the checks still needed alongside
the read-only detector result.

## Guardrails

- Discover surfaces dynamically; do not rely on an issue file inventory.
- Change only the maintenance unit named by the issue.
- Resolve compatibility work instead of evading the available supported
  release.
- Never use floating versions for project-bound npm dependencies or the
  canonical npm toolchain.
- Preserve the repository's verified rolling channels for standalone tools.
- Keep explicit lifecycle-script approvals limited to reviewed dependencies.
