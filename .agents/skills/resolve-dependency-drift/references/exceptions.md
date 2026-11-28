# Container Vulnerability Exceptions

## Bind the evidence

1. Read the canonical gate's exception records, validator, evidence
   requirements, and scope rules. Discover the repository's
   tracker and approved override workflow, including support for built and
   upstream images. Verify the evaluator can express the approved scope before
   applying a record.
2. Obtain the complete matching policy decision, scan report, SBOM, scanner
   database status, and build or release metadata. Discover artifacts from
   the owning workflow, including failed jobs. Bind the evidence to the
   expected source commit, image, and independently verified manifest
   digest. Keep the evidence outside Git.
3. Match the exact advisory, package, installed version, and affected image.
   Record vendor fix status, reachability, and residual risk. Use current
   primary sources and state what is uncertain. For accepted risk, require
   evidence that fixes, source patches, and removal were assessed. Accept an
   evidence-backed override directly when authoritative evidence shows the
   exact installed copy is unaffected or already mitigated.
   Use any existing package ticket as evidence. [Assess the finding](remediation.md#assess-scanned-findings)
   if evidence is missing or a fix becomes available.

## Change the record

Apply only record edits selected by the user.

- **Add:** For the approval request, show the advisory, verified
  aliases, component and installed version, exact image scope, rationale,
  supporting evidence, residual risk, owner, review date, expiry, and removal
  condition. Ask once to apply the record and create or reuse its ticket. After
  approval, search for a matching ticket labeled
  `remediation:container-vulnerability`. Reuse it on retries or create one
  with that label for the advisory and approved scope. Record the decision
  before applying the exact override using the repository schema. Keep the
  ticket open with the next check if application or verification fails.
  Publish only facts and links approved for that tracker. Keep full scan
  reports with the scan evidence.
- **Review or update:** Use fresh evidence. Apply the add criteria to an
  extension or replacement scope. Remove stale or expired records as the
  repository policy requires. Preserve any separate package workaround
  until [remediation verification](remediation.md#verify-and-record) confirms
  its cleanup.
- **Remove after a fix:** Report the obsolete record as a cleanup candidate.
  Apply the edit when the user selects cleanup and candidate evidence shows
  the finding is gone or no longer matches the exact record. An evaluator failure
  for a stale record can supply the report for this check. Evaluate the
  proposed removal against that candidate and report any remaining blocker.

Keep the canonical evaluator, severity threshold, full reports, and
promotion gate in force.

## Validate

1. After the selected edits are in place, evaluate the complete approved set
   once for the exact image and digest. Use the upstream, local candidate, or
   release scope and complete unfiltered evidence.
2. Verify each approved override appears on its exact finding and unrelated
   findings retain their disposition. For removal, verify the obsolete override
   is gone and check the full report for the finding. Report override success
   separately from the gate result, including remaining blockers and errors.
3. Reconcile every ticket linked from an approved override for the scanned
   image and digest. Record its individual match, the same overall gate
   result, and a durable link to retained scan evidence. If the link is
   missing, say so and reconcile again when it is available. Record ticket
   URLs and states, scanner dispositions, gate consequences, and next checks
   together. Report any ticket or CI check still needed. Recommend a PR for
   record changes.
