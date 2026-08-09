# Production Quadlet Containment

This guide defines the supported containment contract for the stateless
`app-runtime` and nginx production services. It applies to the `app-node-tls`,
`app-node-http`, and `single-node` topologies in the deployment archive.

## Host prerequisites

Run the helper as the dedicated rootless service user before installing or
reinstalling units:

```bash
cd /opt/kravhantering/current
bin/kravhantering-quadlet.sh verify-host --topology app-node-tls
```

The check fails closed unless the host has cgroup v2, a working user systemd
manager, rootless Podman, delegated `cpu`, `memory`, and `pids` controllers, a
compatible Quadlet generator, and finite journal retention. `install` repeats
the check after rendering into a temporary directory and does not replace the
active units when validation fails.

Configure `SystemMaxUse` or `SystemKeepFree` in `journald.conf` on the host.
The per-unit rate limits below reduce log-flood amplification; they do not
limit total journal disk use.

## Default service boundaries

Both services drop every Linux capability, prevent new privileges, use a
read-only root filesystem, and send stdout and stderr to journald. The
`ReadOnlyTmpfs=false` setting is deliberate: it prevents Podman from silently
adding generic writable `/run`, `/tmp`, and `/var/tmp` mounts.

<!-- markdownlint-disable MD013 -->
| Service | Writable paths | Memory | CPU | PIDs / tasks |
| --- | --- | ---: | ---: | ---: |
| `app-runtime` | `/run/kravhantering/export` 1 GiB; `/tmp` 64 MiB | 4 GiB | 300% | 512 / 544 |
| nginx | `/etc/nginx/conf.d` 1 MiB; `/var/cache/nginx` 64 MiB; `/run` 1 MiB | 512 MiB | 100% | 128 / 160 |
<!-- markdownlint-enable MD013 -->

The application export tmpfs is sized above the built-in maximum concurrent
output reservation: five 100 MiB CSV outputs plus three 50 MiB PDF outputs,
650 MiB in total. Tmpfs pages count against the service memory cgroup. Capacity
tests must therefore exercise the configured concurrent export maximum after
changing either limit. Podman 4.9 does not accept `uid` or `gid` options on a
`Tmpfs=` mount, so the dedicated mount uses mode `1777`. The app remains the
only workload in the container, and each generated operation directory and
file is still created with mode `0700` and `0600`, respectively.

nginx writes generated configuration to `/etc/nginx/conf.d`, request and proxy
buffers to `/var/cache/nginx`, and its PID to `/run/nginx.pid`. Access and error
logs go to stdout and stderr; `/var/log/nginx` is not writable. Podman's `U`
tmpfs option maps the three container-local writable roots to nginx UID 101
while retaining modes `0755`, `0750`, and `0755`; `notmpcopyup` keeps
root-owned image files out of those scratch mounts. TLS topologies require the
crun OCI runtime so nginx can also preserve the rootless service user's group
access to the host's `0640` private key.

## Validated overrides

Set overrides in `/etc/kravhantering/release.env`. Values are decimal integers
without signs, whitespace, units, or shell expressions. The helper rejects
unknown storage modes and values outside these ranges.

<!-- markdownlint-disable MD013 -->
| Variable | Default | Accepted values |
| --- | ---: | --- |
| `APP_RUNTIME_MEMORY_LIMIT_MIB` | 4096 | 4096–8192 |
| `APP_RUNTIME_CPU_QUOTA_PERCENT` | 300 | 50–online CPUs × 100 |
| `APP_RUNTIME_PIDS_LIMIT` | 512 | 128–1024 |
| `APP_RUNTIME_EXPORT_STORAGE` | `tmpfs` | `tmpfs` or `bind` |
| `APP_RUNTIME_EXPORT_TMPFS_MIB` | 1024 | 1024–4096 and at most half of app memory |
| `APP_RUNTIME_LOG_RATE_INTERVAL_SECONDS` | 30 | 10–60 |
| `APP_RUNTIME_LOG_RATE_BURST` | 2000 | 100–10000 |
| `NGINX_MEMORY_LIMIT_MIB` | 512 | 256–1024 |
| `NGINX_CPU_QUOTA_PERCENT` | 100 | 25–online CPUs × 100 |
| `NGINX_PIDS_LIMIT` | 128 | 32–512 |
| `NGINX_CACHE_TMPFS_MIB` | 64 | 16–256 and at most half of nginx memory |
| `NGINX_LOG_RATE_INTERVAL_SECONDS` | 30 | 10–60 |
| `NGINX_LOG_RATE_BURST` | 6000 | 500–50000 |
<!-- markdownlint-enable MD013 -->

The helper derives `TasksMax` as the PIDs limit plus 32 for the Podman and
conmon supervisors. Combined CPU quotas cannot exceed the smaller of the
online CPU capacity and 400%, preserving the documented single-node capacity
for stateful services.

For disk-backed exports, set:

```ini
APP_RUNTIME_EXPORT_STORAGE=bind
APP_RUNTIME_EXPORT_HOST_PATH=/srv/kravhantering/export
```

The host path must be an existing absolute directory, not a symbolic link. It
must have mode `0700` and be readable, writable, and searchable by container
UID and GID 1000 through the service user's rootless mapping. Prepare it as
root, then establish the mapped owner as the service user:

```bash
sudo install -d -m 0700 -o kravhantering -g kravhantering \
  /srv/kravhantering/export
sudo -iu kravhantering podman unshare \
  chown 1000:1000 /srv/kravhantering/export
```

The helper verifies access through the same Podman user namespace. The path is
always mounted with a private SELinux label at
`/run/kravhantering/export` in the container. Do not make other application
paths writable.

## Network ownership

Use the helper instead of deriving Podman network names:

```bash
bin/kravhantering-quadlet.sh print-network \
  --topology single-node --purpose database
```

The app-node topology has an internal `edge` network shared by nginx and the
app, plus an `egress` network used by the app. Single-node adds internal
`identity` and `database` networks. nginx joins `edge` and `identity`, the app
joins `edge`, `database`, and `egress`, Keycloak joins `identity`, and SQL
Server joins `database`. Temporary database jobs join only `database`. Only
nginx publishes a host port.

On single-node, the application maps the public hostname to Podman's host
gateway so its OIDC discovery and token requests traverse the published
`443`-to-`8443` nginx route. Podman 4.9 lacks the newer Quadlet `AddHost` and
`NetworkAlias` keys, so the units use narrowly scoped `PodmanArgs` only for
that host mapping and their required service DNS aliases. These arguments do
not grant a capability or add a writable path, and incompatible generators
fail during the helper preflight.

Podman bridge membership does not provide directional, per-port, or DNS-name
egress policy. The host firewall, an approved egress proxy, and upstream ACLs
remain responsible for source CIDR restrictions and destination allowlists.

## Logging and evidence limits

The application currently multiplexes ordinary, capacity, and security-audit
JSON records on stdout and stderr. Unit-level rate limiting is therefore lossy
for every one of those streams during overload. Alert on journal suppression
messages and do not claim complete security-audit retention from journald. The
database-backed action log remains the durable audit record. A future lossless
security-audit sink must be separate from the rate-limited service stream.

PR and release workflows install the real production archive on Ubuntu 24.04
under a dedicated rootless user, execute the documented database lifecycle,
inspect the generated units and live containers, run the release Playwright
suite, and exercise restart, reinstall, stop, start, and removal. That proves
archive and Quadlet parity. Before production rollout, retain RHEL qualification
for SELinux labels, firewalld policy, the supported RHEL Podman version, load
behaviour, and persistence across a real host reboot.

## RHEL qualification record

Before promoting a release to production, run the selected topology under its
expected load on a supported RHEL host and retain these results with the change
record:

```bash
getenforce
podman version
firewall-cmd --get-active-zones
firewall-cmd --list-all
systemctl is-active systemd-journald
sudo -iu kravhantering \
  /opt/kravhantering/current/bin/kravhantering-quadlet.sh verify-host \
  --topology app-node-tls
sudo -iu kravhantering systemctl --user show \
  kravhantering-app-runtime.service kravhantering-nginx.service \
  -p MemoryMax -p CPUQuotaPerSecUSec -p TasksMax \
  -p LogRateLimitIntervalUSec -p LogRateLimitBurst
sudo -iu kravhantering podman inspect \
  kravhantering-app-runtime kravhantering-nginx
```

Confirm the expected SELinux labels on every bind source with `ls -lZ`, run the
public health, authentication, application, and API-documentation checks, and
repeat the output-capacity and nginx buffering load. Reboot the host, then
verify that lingering is enabled, the topology target is active, the named
volumes and purpose-specific networks remain, and health and readiness recover
without manual login:

```bash
loginctl show-user kravhantering -p Linger
sudo -iu kravhantering systemctl --user is-active \
  kravhantering-app-node.target
sudo -iu kravhantering podman network ls
sudo -iu kravhantering podman volume ls
```

For `single-node`, substitute `kravhantering-single-node.target`. Record the
exact RHEL, kernel, systemd, Podman, SELinux policy, and firewalld versions with
the results. A missing controller, unexpected writable mount, extra published
port, journal suppression during the normal load, or failed reboot recovery
blocks rollout.
