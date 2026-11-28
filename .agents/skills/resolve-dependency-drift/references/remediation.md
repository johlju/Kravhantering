# Container Vulnerability Remediation

## Assess scanned findings

1. Bind evidence to the exact source commit, image digest, complete report,
   SBOM, and scanner database. For a PR, compare the failing commit with
   its current head and obtain current evidence when they differ. Use the
   repository's gate workflow and policy to locate the evidence and identify
   blocking findings.
2. Build the review checklist from the complete scanner reports. Include the
   [report scope](finding-report.md) and every finding marked by the gate. If
   the gate has no review markers, include all Critical and High findings in
   the checklist. Complete any other checks required by the gate. Include
   supplemental and excepted findings and findings with no published fix.
   Group matches by exact image, affected package copy, and advisory. Merge
   scanner entries only when the package copy matches and advisory IDs match
   or their aliases are verified.
3. Search [remediation history](tracking.md#find-prior-remediation)
   before recommending a fix. Cite relevant tickets and explain whether their
   solution still applies. Recheck applicable exceptions for new fix evidence.
   Report active exceptions that are still needed and any that qualify for
   cleanup or require a new decision.
4. Work through [Remediate in order](#remediate-in-order) before presenting a
   decision. Complete the assessment when every finding in report scope and
   every item on the gate checklist has a recommendation or concrete next
   check. Use [exception maintenance](exceptions.md) for a scoped override.

## Recheck existing tickets

For a supplied ticket, read its next checks, base selection, workaround, and
fix criteria. For a replacement image, find open tickets with the
[template's required label](template.md). Match by maintenance unit or
upstream image family. Read the ticket bodies to account for shared bases,
package locations, and all affected consumers.

Inspect the exact unmodified candidate. When starting from a ticket, use
[Resolve the upstream candidate](image-update.md#resolve-the-upstream-candidate).
During an image update, reuse the selected digest. Use an external SBOM,
package metadata, and authoritative fixed-version or backport evidence
to prove the affected copy is fixed or absent for every scope to be cleaned up.
A scan of an adapted image can miss a package its workaround already removes.

- **Fixed upstream:** Report the selected digest, obsolete remediation, and
  ticket that can close with the verified image change. List remaining closure
  checks. Apply only cleanup selected by the user. For selected changes, use
  the [image update](image-update.md) or [exception maintenance](exceptions.md)
  instructions that apply.
- **Still affected or evidence incomplete:** Keep the workaround and ticket
  open. Record the digest checked, what remains affected or uncertain, and
  the next check. During an image update, test the current workaround on the
  selected candidate.

## Remediate in order

Use this order to recommend a fix. When applying selected remediation, finish
each path with verified remediation or evidence of why it cannot solve the
case before trying the next path. If available fixes clear only some findings,
test them together and recommend verified changes that reduce risk now.
Continue through the order for the remaining findings. State which findings
still block promotion and what decision they need. Treat the next vendor
release as a follow-up check.

When authoritative evidence shows the exact installed component is unaffected
or already mitigated, recommend an evidence-backed override directly. Cite
the evidence for that copy and state any residual uncertainty. Complete the
release check in step 1 before presenting that recommendation. Apply this
rule to supplemental findings too.

1. **Update the upstream image.** [Resolve the upstream candidate](image-update.md#resolve-the-upstream-candidate)
   before considering package changes. For a newer image the user selects,
   use its SBOM, package metadata, or artifact inspection and authoritative
   fix or backport evidence to establish which findings it addresses. Run
   the canonical gate and relevant runtime tests against its exact digest.
   Record the lane, releases checked, packaged versions, and deployment
   assumptions. Recommend the update for findings it mitigates. If a newer
   image is unavailable, unsuitable, still affected, or the user chooses
   the original target, explain the result and continue with package fixes
   for the remaining findings.
2. **Install a fixed package.** Assess package fixes against the selected
   image. Verify the compatible fixed version with authoritative evidence.
   If evidence is missing or inconclusive, say so and give the next check.
   Use RPM-aware comparisons for RPMs. Inspect the selected base and any
   build-time package update steps for inherited packages.
   For a vendor image with compatible fixed packages available, install the
   updates in a disposable build from the exact candidate digest before
   asking for an adoption decision. Verify the installed versions. Run the
   existing gate and affected runtime tests on that build with isolated test
   resources. Keep the test recipe and evidence outside Git. Record the
   tested image digest, package versions, gate result, and runtime test
   outcome. If a check cannot run, state what remains unverified. Use these
   results to decide whether to recommend adopting the fix.
   A package-list entry passes this step only when a rebuild installs the fix.
3. **Patch from source.** Obtain authenticated, pinned vendor or upstream
   sources and the actual fixes. Record source and patch hashes, signature
   verification, builder identity, recipe, output identity, notices, and
   provenance. Build the package and test its ABI, runtime configuration,
   crypto policy, and affected behavior in the target image. Keep its package
   identity truthful; changing a version to clear a scanner is not a patch.
   Record unavailable inputs, failed builds, or unresolved compatibility
   evidence when this path cannot deliver a verified fix.
4. **Remove unused software.** Inspect production entrypoints, application
   calls, health checks, native-library linkage, database and identity clients,
   and operational commands. Resolve the complete dependency removal list and
   report each package's purpose and evidence that production does not need
   it. When production uses a package, or use remains uncertain, recommend
   retaining it and continue to the exception step. Otherwise remove the
   reviewed list with normal dependency checks after all build-time consumers
   finish. Preserve accurate package inventory, trust material, licenses, and
   required runtime behavior. Record collateral tools removed and how their
   build-time or diagnostic purpose is served. Verify the final workloads.
5. **Override this advisory.** When the earlier paths cannot fix an affected
   component, propose an exact override for accepted risk and explain why the
   prior actions are unavailable. Use this action for supplemental findings
   when the evaluator supports their scope. If it does not, report the missing
   support and a concrete next check. Use [exception maintenance](exceptions.md)
   to verify the match and preserve the complete scanner evidence.

## Verify and record

- After a package or image change, [verify affected images](image-update.md#verify-affected-images).
  Reuse checks that already cover the exact rebuilt image. For source
  patches, test the affected behavior. For removal, check native linkage
  and workloads after the complete package removal.
- Assess operator guidance and update affected build and runtime guidance
  using the repository's release process.
- After a local package change, draft a labeled [tracking ticket](template.md)
  or an update to the matching ticket. Account for every affected image,
  remaining blocker, and temporary change.
- Apply [the tracking contract's closure rules](tracking.md#lifecycle).
  Recommend a PR and report which tickets can close on merge, which checks
  are still needed, and which tickets should stay open.
