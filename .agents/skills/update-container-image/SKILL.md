---
name: update-container-image
description: >-
  Update or verify a pinned upstream container image. Use for a requested
  image refresh, a container drift handoff, or verification after a package
  remediation. Synchronize pins and consumers, check open workarounds, and
  verify the rebuilt images.
---

# Update Container Image

Accept an image name or maintenance unit, an optional target tag or digest,
and any ticket or CI evidence supplied by the caller. Use **Verify affected
images** alone when the caller already applied the change.

Resolve [the canonical gate](#canonical-gate) before making changes. Follow
[the local handoff](#local-handoff) for the requested scope.

## Select and update

1. Find the repository's authoritative image reference, such as an image
   lock, maintenance registry, Dockerfile, or deployment configuration. Find
   its owner, release lane, supported platforms, and consumers. Ask if the
   repository evidence does not establish which reference to update.
2. Resolve the exact vendor candidate and verify it is available on the
   supported lane. Preserve the repository's tag, index digest, platform
   manifest digest, and config digest policy. When the caller supplies a
   digest, verify and use that identity. A rebuild of an old pin keeps the
   old base.
3. Ask `$remediate-container-vulnerabilities` to recheck matching open
   remediation tickets for the maintenance unit and exact unmodified
   candidate. Use the repository's ticket conventions. Reuse reviews for the
   same digest and case. Keep workarounds with incomplete evidence and report
   which tickets could not be assessed.
4. Update the authoritative reference and synchronize all owned consumers
   before final verification. Update the image lock if the repository uses
   one. Otherwise update the configuration that selects the image. Preserve
   each consumer's reference format and package policy.
   Report obsolete workarounds and exceptions as cleanup candidates with the
   tickets the image change could close. Apply only remediation or cleanup the
   user selected. Hand selected exception edits to
   `$manage-container-vulnerability-exceptions`.
5. Search for remaining old references. Account for each active match and
   update maintenance coverage when the repository requires it.

## Verify affected images

1. Read the current authoritative reference back and confirm it selects the
   intended candidate. Rebuild every affected consumer from that selection,
   including helpers and release-only consumers. Use the repository's
   supported build, smoke, integration, and release workflows. Bypass cached
   package steps when verifying a package change or workaround removal.
2. Verify the selected base and final image identities, complete SBOMs,
   affected package versions or absence, and supported runtime behavior.
   Run the [canonical gate](#canonical-gate) against the exact selected image
   or its rebuilt consumers. Use any pre-update scan as assessment evidence.
   Use the registry reference for an upstream image and the build artifact
   for an image built locally. Retain the complete evidence. Run repository
   checks through the documented commands. Keep scan artifacts outside Git.
3. Build the post-scan review checklist from every entry the gate marks for
   remediation review. If the gate has no markers, use every High or Critical
   finding from the complete scanner reports. Review the checklist whether the
   gate passed or blocked the candidate. For a nonempty checklist, pass the
   exact image identity, checklist, grouped findings, gate decision, and
   evidence to `$remediate-container-vulnerabilities`. If it requested verification,
   return the full checklist and evidence to it for assessment, including any
   new findings.
4. Complete image verification only when the assessment accounts for every
   checklist entry with a recommendation or concrete next check. Check
   coverage by exact image, affected package copy, and advisory. Merge only
   verified aliases across scanners. A pre-update ticket review does not
   complete this assessment. If evidence or assessment is missing, report it
   as pending. Rebuild and verify changes the user selects. Repeat the
   open-ticket review if the selected base digest changes.
5. Include the assessment in the final report for the exact candidate or
   commit. For each assessed case, carry forward the scanner disposition,
   effect on promotion, tracking ticket state, and next check together.
   Give final counts by severity for each configured scanner. For
   completed scans, show Critical and High counts even when zero and include
   every other severity present. Report zero total findings only when all configured
   scans completed and found nothing. Mark missing or failed scans as
   incomplete. Diagnose infrastructure and other non-package failures through
   the owning workflow. Give the gate decision separately, link the evidence,
   and list pending PR or release checks, including release-only consumers that
   PR CI omits.

## Canonical gate

Use the gate provided by the caller or declared in the repository's agent
instructions. It should identify the command or workflow and its evidence.
If none is provided, find the likely gate in the repository, show the user
the proposed gate, and wait for confirmation before using it.

## Local handoff

For an assessment, recommend the change. For an implementation request, make
the change locally and run available local checks. Use existing CI and ticket
evidence read-only. Leave branch publication, PR creation or edits, and ticket
mutations to a separate user-directed workflow.

Return the proposed or applied change, completed checks, and checks still
needed. Recommend a PR when there is a change to publish. Recommend closure on
merge using the repository's convention once the unmodified candidate fixes or
omits the affected copy, the change removes the obsolete remediation, and the
exact PR commit passes checks for every affected image and advisory. List
pending closure candidates and the evidence they still need. Keep tickets
open when the change retains a workaround or covers only part of the case.
