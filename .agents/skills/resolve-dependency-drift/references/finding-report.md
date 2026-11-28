# Container Finding Report

Write each entry in plain language. Use the user's requested scope, or
Critical and High by default. Use one entry per advisory and affected package
copy. Sort by highest reported severity first, then by CVE or advisory ID
and affected package. Break ties by image and package location. Use these
labels and order in direct reports and handoffs.

```markdown
- **CVE or advisory** — <CVE or scanner advisory ID, severity, image, and affected package version>
  - **What it is** — <One plain-language sentence about what can go wrong and when.>
  - **Recommended action** — <First applicable action from Remediate in order and the specific change.>
  - **Why** — <Evidence for this recommendation, why it fits this copy, and any uncertainty.>
  - **Status and next check** — <Scanners that report it, effect on promotion and why, whether an exception is needed, ticket state and link, and what to check next.>
```

Use a CVE only when it is confirmed. Include the location if it distinguishes
copies. Cite the evidence in **Why**. Reserve **Recommended action** for a
remediation choice. Use `None` when you recommend no change. If the evidence
does not support a recommendation, write `Evidence is missing or inconclusive`.
Put follow-up work under **Status and next check**, such as checking the next
vendor release. Say explicitly whether an exception is needed, unnecessary,
or undecided. Use open and closed for tickets and reported or absent for
scanner findings. Say when there is no tracking ticket.

## Scan summary

Report final counts by severity for each configured scanner. For completed
scans, show Critical and High counts even when zero and include every other
severity present. Say the scans found nothing only if every configured scan
completed and every total is zero. Mark missing or failed scans as incomplete
and link the evidence. Report the gate decision separately.
