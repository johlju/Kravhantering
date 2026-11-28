# Container Image Update

For an assessment, inspect the candidate and keep test builds isolated.
If the user already applied the change, start at
[Verify affected images](#verify-affected-images).

## Select and update

1. Find the authoritative image reference, such as an image lock, maintenance
   registry, Dockerfile, or deployment configuration. Find its owner, release
   lane, supported platforms, and consumers. Ask if the evidence does not
   establish which reference to update.
2. Resolve the exact vendor candidate and verify availability on the supported
   lane. Preserve the repository's tag, index digest, platform manifest digest,
   and config digest policy. Verify and use any digest supplied by the user.
3. [Recheck open remediation tickets](remediation.md#recheck-existing-tickets)
   for the maintenance unit and exact unmodified candidate. Reuse reviews
   for the same digest and case.
4. For a requested image update, update the authoritative reference and
   synchronize all owned consumers before final verification. Update the
   image lock if the repository uses one. Otherwise update the configuration
   that selects the image. Preserve each consumer's reference format and
   package policy.
5. Report obsolete workarounds and exceptions as cleanup candidates. Apply
   cleanup the user selects. Use [exception maintenance](exceptions.md) for
   selected record edits. Account for remaining old references and update
   maintenance coverage when the repository requires it.

## Verify affected images

1. After changing the image selection, read the authoritative reference back
   and confirm it selects the intended candidate. Rebuild every affected
   consumer, including helpers and release-only consumers. Use the repository's
   supported build, smoke, integration, and release workflows. Bypass cached
   package steps when verifying a package change or workaround removal.
2. Verify the selected base and final image identities, complete SBOMs,
   affected package versions or absence, and supported runtime behavior.
   Run the canonical gate on the exact candidate or its rebuilt consumers.
   Use the registry reference for an upstream image and the build artifact
   for a locally built image. Use a matching earlier scan as assessment
   evidence. Retain complete evidence outside Git.
3. [Assess the findings](remediation.md#assess-scanned-findings) for the exact
   candidate, whether the gate passes or blocks. Use the current scan for
   this assessment. The earlier ticket recheck covers workarounds on the
   unmodified base. After a selected change, rebuild and verify again.
   Repeat the open-ticket review if the selected base digest changes.
4. Diagnose infrastructure failures through the owning workflow. Record
   checks still needed, including release-only consumers that PR CI omits.
