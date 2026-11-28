# Remediation ticket template

Write an action-oriented title that names the package and image family.

Required tracker label: `remediation:container-vulnerability`. Include it in
the draft's label list. Apply it when creating the ticket or adopting an
existing ticket for remediation. Add any other labels the repository requires.

Copy the body below. Keep the headings, field labels, and order. Replace every
placeholder. Mark missing facts as unknown and checks still needed as pending.
Use plain language. Put the result in the first sentence of **Action taken**
and the reader's next action or decision in the first sentence of **Next step**.
Keep shell commands, exact digests, and advisory lists in the technical
sections below.

```markdown
## Action taken

<State what changed and where the ticket stands. Explain why it mattered and
what the checks showed. Link the implementation PR if one exists.>

## Next step

<Tell the reader what to do or decide next. Explain what lets them remove the
workaround and close the ticket. Say if this case needs no further action.>

## Finding

- **Image family:** <Maintenance unit or upstream image family>
- **Package:** <Package name or names>
- **Ecosystem:** <Package ecosystem>
- **Owner or location:** <Owning package, component, or installed path>
- **Advisories:** <Advisory identifiers and verified aliases>
- **Affected versions:** <Versions observed in the affected image>

## Evidence

- **Affected images:** <Image names, digests, and source commit>
- **Scan evidence:** <Retained scan evidence link, scan date, database status,
  and policy decision identifier>
- **Fix criteria:** <Vendor references and exact versions or evidence that
  confirm the fix>

## Remediation and cleanup

- **Attempts:** <What was tried in order and the results>
- **Current remediation:** <What changed, where it changed, and verification>
- **Next checks:** <Upstream sources and how to verify a new candidate>
- **Closure criteria:** <What to remove and which checks must pass>
```

When migrating an older ticket, keep its supporting details under
`### Original technical record` after **Remediation and cleanup**. Preserve
subheading names so existing links still work.

For an approved override, include the advisory and approved scope in the
ticket identity. Record the rationale, residual risk, owner, review date,
expiry, and removal condition. State whether the evaluator matched the
override and whether other findings still block the gate. Use the final gate
decision and retained scan evidence for every override ticket for that image.
Keep the ticket open with a concrete next check when verification is incomplete.
