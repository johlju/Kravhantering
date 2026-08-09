# Debugging the production smoke stack locally

Use this workflow when the **Container PR Smoke** job fails after producing
its OCI and runtime artifacts. It recreates the Ubuntu 24.04, systemd, rootless
Podman, and Quadlet environment inside one privileged Docker container, then
runs the real production archive installation and release-smoke suite.

This is developer and CI diagnostic tooling. It does not change the supported
production deployment procedure or replace either production deploy guide.
The npm script is the supported entry point: it owns artifact download, debug
host setup, smoke execution, evidence collection, and safe cleanup.

## Quick start

Prerequisites:

- a Linux x86_64 host with Docker, cgroup v2, and at least 10 GiB free;
- Node.js and the repository dependencies already installed;
- GitHub CLI authenticated with access to the workflow run; and
- an internet connection for the pinned vendor image pulls.

Run from the repository root while the branch containing the proposed fix is
checked out:

```bash
npm run container:production-smoke:debug -- run --run-id 31331091579
```

The PR workflow keeps OCI artifacts for two days, so start from a recent run.
For a fork, add `--repo owner/repository`.

The command downloads the exact candidate OCI archives and build metadata from
the selected run. It combines those artifacts with the currently checked-out
deployment scripts and Quadlet templates. This makes it useful for proving a
fix without rebuilding the candidate application images.

It then:

1. builds and starts a privileged Ubuntu 24.04 systemd debug host;
2. installs the repository-pinned Playwright Chromium build and its Ubuntu
   runtime libraries inside that disposable host;
3. installs the production archive with the existing
   `production-smoke.sh` entry point;
4. runs the real Playwright release-smoke tests and containment boundaries; and
5. writes redacted evidence below
   `tmp/production-smoke-debug/<run-id>/evidence/`.

The debug host remains running after both success and failure so its state is
available for inspection.

## Inspect a failure

Open a shell in the retained host:

```bash
npm run container:production-smoke:debug -- shell
```

Useful commands inside it include:

```bash
sudo -u kravhantering systemctl --user --failed
sudo -u kravhantering journalctl --user -u 'kravhantering-*' --no-pager
sudo -u kravhantering podman ps --all
```

Use the script to refresh the standard redacted evidence bundle:

```bash
npm run container:production-smoke:debug -- evidence
```

The wrapper supports one named debug host at a time and verifies its ownership
label before entering, collecting evidence, or removing it.

## Clean up

Always remove the nested stack and debug host when finished:

```bash
npm run container:production-smoke:debug -- down
```

Cleanup preserves the downloaded artifacts and evidence under
`tmp/production-smoke-debug/<run-id>/` for later comparison. Remove that exact
run directory manually when it is no longer needed.

`down` removes the nested stack's containers, named volumes, and four Podman
networks before removing the disposable Docker host. The host uses Docker's
existing default bridge, so the debug workflow does not create a separate
Docker network.

## What this proves

This workflow exercises the same production archive installer, rootless
service user, Quadlet generator, systemd lifecycle, network boundaries,
resource limits, HTTPS route, Keycloak realm, SQL Server setup, HSA test
overlay, Playwright suite, and disposable boundary probes as CI.

It is not an exact copy of the hosted runner itself. Docker supplies the outer
kernel and cgroup hierarchy, and the checked-out scripts may be newer than the
selected run. Use the workflow job as the final acceptance gate after the local
reproduction passes.
