---
name: resolve-dependency-drift
description: Resolve a detector-created dependency drift issue for the npm toolchain, a coordinated release toolchain, or a container image, including every synchronized repository surface and required compatibility work. Use when an `automation:dependency-drift` issue provides a maintenance unit with current and available state.
disable-model-invocation: true
---

# Resolve Dependency Drift

## Workflow

1. Read the issue's maintenance unit, current state, available state, and
   completion checklist.
2. Create one isolated directory with
   `mktemp -d /tmp/resolve-dependency-drift.XXXXXX`.
3. Start a background agent with `$research`.
   - For npm, research compatibility, lifecycle-script policy, install paths,
     and verification using primary npm and Node sources.
   - For a container image, research vendor releases, compatibility,
     immutable identity, synchronized surfaces, and verification using primary
     registry and vendor sources.
   - For a release toolchain such as Lychee, research the supported release,
     action compatibility, release assets, published digests, and every
     synchronized installer and CI surface using primary project sources.
   - Override `$research` output handling for this invocation: write its single
     Markdown result inside the exact temporary directory, never in the
     repository.
4. Continue repository discovery while research runs. Read and apply the
   temporary findings before choosing the target or editing.
5. Apply the policy for the issue's maintenance unit:
   - **npm toolchain:** Treat root `package.json` as canonical. Adopt one exact
     reviewed npm version across every dynamically discovered install path.
     Preserve pinned script approvals, explicit denials, fail-closed lifecycle
     policy, and even-LTS Node compatibility.
   - **Container image:** Resolve the requested upstream tag, multi-platform
     index when published, and Linux AMD64 platform manifest. For
     `devcontainer-base`, record the index digest as `manifestDigest` and the
     AMD64 image config digest as `imageId`. Apply the UBI policy below for
     `ubi-node-builder` and `ubi-node-runtime`. For other image lanes, preserve
     their existing platform-manifest identity policy. Update every dynamically
     discovered synchronized surface without changing release-lane policy.
   - **Lychee toolchain:** Update both installer version constants, the CI
     `lycheeVersion`, and both AMD64 and ARM64 asset checksums together. Keep
     the action compatible and pinned to a full commit SHA with its release-tag
     comment, and preserve relational alignment coverage.
6. Update focused tests, generated locks or configuration, the maintenance
   coverage invariant, and affected operator, developer, or CI documentation.
7. Run dynamically relevant verification:
   - For npm, include clean installs, pending script approval checks, nested
     packages, `npm run check`, and `npm audit`.
   - For a container image, include image, release, smoke, workflow, and
     repository checks.
   - For Lychee, include the dependency-drift, dependency-maintenance, workflow
     security, Markdown link, and repository checks relevant to the change.
8. Confirm a detector scan reports no remaining drift for the maintenance
   unit.
9. Remove only the exact temporary directory created in step 2 after applying
   its findings.

## Guardrails

- Discover surfaces dynamically; do not rely on an issue file inventory.
- Change only the maintenance unit named by the issue.
- Resolve compatibility work instead of evading the available supported
  release.
- Never use floating versions for project-bound npm dependencies or the
  canonical npm toolchain.
- Preserve ADR 0045 rolling channels such as `@github/copilot@latest` for
  standalone development tools when their distribution integrity is verified
  or ADR 0045 records an explicit exception. Do not replace those channels with
  routine version pins.
- Keep externally sourced service and base images on their lane's explicit
  identity policy. UBI permits `latest` only with its selected SHA-256 digest;
  other lanes require a non-`latest` tag. Repository-local build outputs do
  not require an explicit Compose `image` or canonical image lock.
- Preserve each image lane's identity policy. Production and release
  references keep their required immutable identities. ADR 0045 development
  references backed by canonical image locks stay explicit, non-`latest`,
  tag-only references; do not append digests to those runtime references.
- For an ADR 0045 development image update, record the required manifest digest
  and image ID in the canonical image lock and update every synchronized
  development tag reference from that lock. Keep the devcontainer base lock's
  `manifestDigest` bound to the multi-platform index, not one platform
  manifest.
- Never approve all lifecycle scripts or update an image lock tag without its
  required immutable identities.
- Do not leave research artifacts in the repository.

## UBI Node Role Updates

- Treat `ubi-node-builder` and `ubi-node-runtime` as independent inputs.
- Read `selectedReference` and registered paths from the named unit in
  `.github/dependency-maintenance.json`. Discover direct references and ARG
  defaults; update every reference for that role and its selection together.
- Preserve public `registry.access.redhat.com/ubi10/nodejs-24` and
  `registry.access.redhat.com/ubi10/nodejs-24-minimal` repositories. Query tags
  and manifests anonymously, without private Red Hat credentials.
- Keep Node 24 and UBI 10. Resolve supported numeric version/revision tags or a
  changed digest under the selected `latest` channel. Pin the returned index
  digest when published, otherwise the manifest digest; verify the Linux AMD64
  manifest and image ID. A moving tag alone cannot be selected.
- Keep remaining Docker Official Node inputs, including the topology helper,
  owned and synchronized during incremental adoption.
- Verify exact replacement inputs through existing image, package, SBOM,
  vulnerability, and production smoke checks. Escalate a demonstrated
  worse-than-current result with comparable evidence and a recommendation;
  distinguish baseline/environment failures and unavailable comparisons.
- For a runtime update, refresh `containers/node/runtime-source.lock.json`
  against the exact public source image. The release check derives source RPM
  correspondence from its original layers and verifies every installed RPM.
  Follow the source retention and verification contract in
  `docs/development/trusted-container-publishing.md` under
  `Runtime Sources And Original Notices`; complete the exact-candidate source
  check before publication. Update native source records with native dependency
  changes and retain original recipe/patch bytes whose upstream URLs can move.
- Preserve no-cost anonymous Node 24 update eligibility through at least April
  2028 as a requirement; verify current access without promising future access.
- Deliver updates as new immutable project releases through existing release
  controls. Keep target-specific issues, reviewed deferrals, and fresh issues
  after unresolved closure or expiry; closed issues stay closed.
