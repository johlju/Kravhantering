# Package remediation tracking

Use one human-managed ticket per remediated package, including its images and
advisories. Draft an update or a new ticket after the package change. For a
scoped override, create or reuse one ticket per advisory and approved scope
after the user approves both actions. Reuse it on retries and record pending
or failed verification there.
Use the template's required tracking label and repository conventions. Track
every vulnerability-driven change to the selected base's packages, including
build-time package updates, source patches, and removals.
Link a related package ticket when one exists. A pin update to a fixed upstream
image without a local workaround belongs to image maintenance.

## Find prior remediation

Search open and closed tickets by the [template's required label](template.md)
and by package or image family in the title. Match the **Finding**
fields before using a ticket as precedent. Read older ticket bodies and any
details needed to verify the match. Cite the prior ticket, summarize what
worked, and confirm the remedy still fits the current image and package.

## Ticket layout

Use [the ticket template](template.md) for titles, headings, and field order.
When updating an existing ticket, preserve historical evidence and unrelated
sections. Apply the template to the sections in scope.

Implementation and coordination tickets may finish when their changes land.
Keep their package remediation in its owning tracking ticket, including the
upstream checks and future cleanup. When work is split this way, link the
tracking ticket and keep the remediation labels on it rather than on the
implementation ticket. Preserve the package evidence when moving that scope.

## Opening summary

In **Action taken**, write two to four short paragraphs using the repository's
ticket language. Explain in plain terms:

- What the build actually does: install a fixed package, build a source patch,
  remove unused software, or apply a user-approved exception. If nothing has
  been applied, state that and identify the proposed action separately.
- Why the action is needed. Distinguish a fix published as a package from a
  fix already included in the original image. Explain coordinated package-set
  updates and any collateral tools removed, without implying a separate
  vulnerability in every package.
- Which PRs introduced or changed this package's remediation. Link each
  relevant PR and explain its change when more than one PR is involved.
- What is verified. Separate a passing rebuilt image from an unchanged
  upstream image or installed release.
  For an exception, state that the affected package remains and that the user
  approved a temporary exception.

Use package names where needed, and explain their purpose in ordinary words.
Put commands, image hashes, CVE lists, and detailed evidence below the summary.

## Next step

Tell the reader to run `$remediate-container-vulnerabilities` with this ticket
and review the recommendation for the exact unmodified upstream image. For
selected cleanup, explain how to update the image selection and its consumers,
remove the obsolete workaround, and verify the rebuilt images with the
repository's gate. Link the owning maintenance workflow for exact steps and
explain how the repository delivers the change to deployed containers.
State when to retain the workaround and ticket, and when cleanup permits closure.
For completed cleanup, state that no further action is needed for this case.
Keep this section short and useful without reading technical details.

Link to an existing detailed-check section when commands, versions, evidence,
or several conditions are needed. Keep those details in one place; a simple
next step needs no duplicate instruction section. Put the remaining technical
evidence below these two opening sections.

Update both opening sections whenever the action, verification state, or next
action changes, including when adopting a ticket or completing its cleanup.

## Required ticket content

Keep these sections current so another invocation can continue without chat:

- **Identity and evidence:** package/ecosystem, installed version, affected
  images and digests, source commit, job URL, scan/database time, CVEs, and
  complete evidence artifact references.
- **Fix criteria:** authoritative advisories, fixed versions, compatibility
  constraints, exact original-image selection and its owning lock or registry,
  and commands that inspect an unmodified candidate. Distinguish published
  advisory versions from packages that can actually be obtained.
- **Attempts:** installation, source patching, then removal; commands, inputs,
  results, and the concrete reason each unsuccessful path failed. For removal,
  list the full dependency closure, production-use evidence, collateral tools,
  retained runtime capabilities, and final inventory/workload checks.
- **Current remediation:** chosen path, code/recipe/lock locations, temporary
  package changes, output identities, exact validated commits, all-image
  verification, and any user-approved exception's scope and lifecycle dates.
- **Next checks:** exact upstream package/image/source URLs, expected versions
  or fixes, what has to change, how to probe it, and what would make each failed
  path viable. State unknown facts explicitly. These instructions are inputs
  for the skill when the user later supplies this ticket.
- **Removal and closure:** identify each temporary rule, patch, update, and
  exception to remove when the original image contains the fix. Specify the
  evidence that proves this and the required rebuild/runtime/scanner checks.

## Lifecycle

Report a passing workaround as remediated with cleanup pending. Keep the
ticket open with its tracking label so the next image update finds it.

- Recommend a tracking link for a PR that adds or retains a workaround or
  covers only part of the case.
- Recommend closure on merge when the unmodified candidate fixes or omits the
  affected copy, the change removes all obsolete remediation, and the exact PR
  commit passes verification across every affected image and advisory. Use the
  repository's closure convention. If checks are pending, list the ticket as
  a closure candidate and state what remains.
- If cleanup already merged, verify the merged change and recommend direct
  closure with its evidence. If an exception becomes stale sooner, propose
  removal of the stale record and document any remaining cleanup in the
  proposed ticket update.
