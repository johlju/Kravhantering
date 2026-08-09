import childProcess from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const SCRIPT_PATH = path.resolve(
  process.cwd(),
  'containers/production/bin/kravhantering-quadlet.sh',
)
const PODMAN_USER_GENERATOR =
  '/usr/lib/systemd/user-generators/podman-user-generator'
const PODMAN_GENERATOR_VERSION =
  childProcess.spawnSync(PODMAN_USER_GENERATOR, ['--version'], {
    encoding: 'utf8',
  }).stdout ?? ''
const temporaryDirectories = []

function createFixture(releaseEnv) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kh-quadlet-'))
  temporaryDirectories.push(root)
  const controllersPath = path.join(root, 'cgroup.controllers')
  const generatorPath = path.join(root, 'podman-user-generator')
  const journalConfigDir = path.join(root, 'journald.conf.d')
  const meminfoPath = path.join(root, 'meminfo')
  const podmanPath = path.join(root, 'podman')
  const systemctlPath = path.join(root, 'systemctl')
  const releaseEnvPath = path.join(root, 'release.env')
  const outputDir = path.join(root, 'rendered')
  fs.mkdirSync(journalConfigDir)
  fs.writeFileSync(controllersPath, 'cpu memory pids\n')
  fs.writeFileSync(meminfoPath, 'MemTotal:       33554432 kB\n')
  fs.writeFileSync(
    path.join(journalConfigDir, 'limits.conf'),
    '[Journal]\nSystemMaxUse=1G\nSystemKeepFree=1G\n',
  )
  fs.writeFileSync(generatorPath, '#!/usr/bin/env bash\nexit 0\n', {
    mode: 0o755,
  })
  fs.writeFileSync(
    podmanPath,
    [
      '#!/usr/bin/env bash',
      'if [[ "$1" == info ]]; then',
      "  printf 'true v2\\n'",
      'elif [[ "$1 $2" == "network inspect" ]]; then',
      "  printf 'true\\n'",
      'fi',
      '',
    ].join('\n'),
    { mode: 0o755 },
  )
  fs.writeFileSync(systemctlPath, '#!/usr/bin/env bash\nexit 0\n', {
    mode: 0o755,
  })
  fs.writeFileSync(releaseEnvPath, releaseEnv)
  return {
    outputDir,
    preflightEnv: {
      KRAVHANTERING_CGROUP_CONTROLLERS_FILE: controllersPath,
      KRAVHANTERING_JOURNAL_CONFIG_DIR: journalConfigDir,
      KRAVHANTERING_MEMINFO_FILE: meminfoPath,
      KRAVHANTERING_PODMAN_BIN: podmanPath,
      KRAVHANTERING_QUADLET_GENERATOR: generatorPath,
      KRAVHANTERING_SYSTEMCTL_BIN: systemctlPath,
    },
    releaseEnvPath,
    root,
  }
}

function releaseEnv(overrides = {}) {
  return `${Object.entries({
    APP_RUNTIME_IMAGE_REF: 'registry.example/app-runtime:1.2.3',
    DB_JOB_IMAGE_REF: 'registry.example/db-job:1.2.3',
    KEYCLOAK_IMAGE_REF: 'registry.example/keycloak:26.7',
    NGINX_HTTP_BIND: '127.0.0.1:9080',
    NGINX_HTTPS_BIND: '8443:443',
    NGINX_IMAGE_REF: 'registry.example/nginx:1.31',
    NGINX_RESOLVER: '10.91.0.1',
    PUBLIC_HOSTNAME: 'kravhantering.example.internal',
    SQLSERVER_IMAGE_REF: 'registry.example/sqlserver:2025',
    ...overrides,
  })
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')}\n`
}

function runHelper(args, fixture, envOverrides = {}) {
  return childProcess.spawnSync('bash', [SCRIPT_PATH, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      KRAVHANTERING_RELEASE_ENV_FILE: fixture.releaseEnvPath,
      ...fixture.preflightEnv,
      ...envOverrides,
    },
  })
}

function render(topology, fixture) {
  const result = runHelper(
    ['render', '--topology', topology, '--output-dir', fixture.outputDir],
    fixture,
  )
  expect(result.stderr).toBe('')
  expect(result.status).toBe(0)
  return fs
    .readdirSync(fixture.outputDir)
    .sort()
    .map(file => ({
      content: fs.readFileSync(path.join(fixture.outputDir, file), 'utf8'),
      file,
    }))
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true })
  }
})

describe('kravhantering Quadlet helper', () => {
  it('renders concrete app-node TLS units at the public CLI seam', () => {
    const fixture = createFixture(releaseEnv())
    const units = render('app-node-tls', fixture)

    expect(units.map(unit => unit.file)).toEqual([
      'kravhantering-app-node-edge.network',
      'kravhantering-app-node-egress.network',
      'kravhantering-app-node.target',
      'kravhantering-app-runtime.container',
      'kravhantering-nginx.container',
    ])
    expect(
      units.find(unit => unit.file === 'kravhantering-app-node-edge.network')
        ?.content,
    ).toContain('Internal=true')
    expect(
      units.find(unit => unit.file === 'kravhantering-app-node-egress.network')
        ?.content,
    ).not.toContain('Internal=true')
    const appRuntime = units.find(
      unit => unit.file === 'kravhantering-app-runtime.container',
    )?.content
    expect(appRuntime).toContain('DropCapability=all')
    expect(appRuntime).toContain('NoNewPrivileges=true')
    expect(appRuntime).toContain('ReadOnly=true')
    expect(appRuntime).toContain('ReadOnlyTmpfs=false')
    expect(appRuntime).toContain('PidsLimit=512')
    expect(appRuntime).toContain('LogDriver=journald')
    expect(appRuntime).toContain(
      'Tmpfs=/run/kravhantering/export:rw,size=1024M,mode=0700,uid=1000,gid=1000,nosuid,nodev,noexec',
    )
    expect(appRuntime).toContain(
      'Tmpfs=/tmp:rw,size=64M,mode=1777,nosuid,nodev,noexec',
    )
    expect(appRuntime).toContain(
      'Environment=KRAVHANTERING_EXPORT_TEMP_DIR=/run/kravhantering/export',
    )
    expect(appRuntime).toContain('Network=kravhantering-app-node-edge.network')
    expect(appRuntime).toContain(
      'Network=kravhantering-app-node-egress.network',
    )
    expect(appRuntime).toContain('MemoryMax=4096M')
    expect(appRuntime).toContain('CPUQuota=300%')
    expect(appRuntime).toContain('TasksMax=544')
    expect(appRuntime).toContain('LogRateLimitIntervalSec=30s')
    expect(appRuntime).toContain('LogRateLimitBurst=2000')
    const nginx = units.find(
      unit => unit.file === 'kravhantering-nginx.container',
    )?.content
    expect(nginx).toContain('Image=registry.example/nginx:1.31')
    expect(nginx).toContain('PublishPort=8443:8443')
    expect(nginx).toContain('Environment=NGINX_RESOLVER=10.91.0.1')
    expect(nginx).toContain('User=101:101')
    expect(nginx).toContain('DropCapability=all')
    expect(nginx).toContain('NoNewPrivileges=true')
    expect(nginx).toContain('ReadOnly=true')
    expect(nginx).toContain('ReadOnlyTmpfs=false')
    expect(nginx).toContain('PidsLimit=128')
    expect(nginx).toContain('LogDriver=journald')
    expect(nginx).toContain(
      'Tmpfs=/etc/nginx/conf.d:rw,size=1M,mode=0755,uid=101,gid=101,nosuid,nodev,noexec',
    )
    expect(nginx).toContain(
      'Tmpfs=/var/cache/nginx:rw,size=64M,mode=0750,uid=101,gid=101,nosuid,nodev,noexec',
    )
    expect(nginx).toContain(
      'Tmpfs=/run:rw,size=1M,mode=0755,uid=101,gid=101,nosuid,nodev,noexec',
    )
    expect(nginx).toContain('MemoryMax=512M')
    expect(nginx).toContain('CPUQuota=100%')
    expect(nginx).toContain('TasksMax=160')
    expect(nginx).toContain('LogRateLimitIntervalSec=30s')
    expect(nginx).toContain('LogRateLimitBurst=6000')
    expect(units.map(unit => unit.content).join('\n')).not.toMatch(
      /(?:@@[A-Z_]+@@|\$\{[^}]+\})/u,
    )
    expect(units.map(unit => unit.content).join('\n')).not.toMatch(
      /^(?:After|Requires)=.*\.(?:container|network|volume)(?:\s|$)/mu,
    )
  })

  it('renders the app-node HTTP bind independently from TLS', () => {
    const fixture = createFixture(releaseEnv())
    const units = render('app-node-http', fixture)
    const nginx = units.find(
      unit => unit.file === 'kravhantering-nginx.container',
    )?.content

    expect(nginx).toContain('PublishPort=127.0.0.1:9080:8080')
    expect(nginx).toContain('app-node-http.conf.template')
    expect(nginx).not.toContain('fullchain.pem')
  })

  it('renders single-node services, volumes and the public issuer host route', () => {
    const fixture = createFixture(releaseEnv())
    const units = render('single-node', fixture)
    const allContent = units.map(unit => unit.content).join('\n')

    expect(units.map(unit => unit.file)).toEqual([
      'kravhantering-app-runtime.container',
      'kravhantering-keycloak-data.volume',
      'kravhantering-keycloak.container',
      'kravhantering-nginx.container',
      'kravhantering-single-node-database.network',
      'kravhantering-single-node-edge.network',
      'kravhantering-single-node-egress.network',
      'kravhantering-single-node-identity.network',
      'kravhantering-single-node.target',
      'kravhantering-sqlserver-data.volume',
      'kravhantering-sqlserver.container',
    ])
    expect(allContent).toContain('NetworkName=kravhantering-single-node_edge')
    expect(allContent).toContain('VolumeName=kravhantering-sqlserver-data')
    expect(allContent).toContain('VolumeName=kravhantering-keycloak-data')
    expect(allContent).toContain(
      'PodmanArgs=--add-host=kravhantering.example.internal:host-gateway',
    )
    expect(allContent).toContain(
      'Volume=/etc/kravhantering/tls/ca.crt:/run/kravhantering/tls/ca.crt:ro',
    )
    expect(allContent).not.toMatch(
      /^(?:After|Requires)=.*\.(?:container|network|volume)(?:\s|$)/mu,
    )
  })

  it.runIf(
    fs.existsSync(PODMAN_USER_GENERATOR) &&
      PODMAN_GENERATOR_VERSION.includes('4.9.3'),
  )('uses the Podman 4.9-compatible public issuer host mapping', () => {
    const fixture = createFixture(releaseEnv())
    render('single-node', fixture)
    const generatorEnv = {
      ...process.env,
      QUADLET_UNIT_DIRS: fixture.outputDir,
    }
    const fallback = childProcess.spawnSync(
      PODMAN_USER_GENERATOR,
      ['--user', '--dryrun'],
      { encoding: 'utf8', env: generatorEnv },
    )

    const controlDir = path.join(fixture.root, 'unsupported-add-host')
    fs.cpSync(fixture.outputDir, controlDir, { recursive: true })
    const appUnitPath = path.join(
      controlDir,
      'kravhantering-app-runtime.container',
    )
    fs.writeFileSync(
      appUnitPath,
      fs
        .readFileSync(appUnitPath, 'utf8')
        .replace('PodmanArgs=--add-host=', 'AddHost='),
    )
    const unsupported = childProcess.spawnSync(
      PODMAN_USER_GENERATOR,
      ['--user', '--dryrun'],
      {
        encoding: 'utf8',
        env: { ...process.env, QUADLET_UNIT_DIRS: controlDir },
      },
    )

    expect(fallback.status, fallback.stderr).toBe(0)
    expect(unsupported.status).not.toBe(0)
    expect(unsupported.stderr).toContain("unsupported key 'AddHost'")
  })

  it('fails before writing units when a required release value is missing', () => {
    const fixture = createFixture(releaseEnv({ APP_RUNTIME_IMAGE_REF: '' }))
    const result = runHelper(
      [
        'render',
        '--topology',
        'app-node-tls',
        '--output-dir',
        fixture.outputDir,
      ],
      fixture,
    )

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(
      'release.env is missing required value: APP_RUNTIME_IMAGE_REF',
    )
    expect(fs.existsSync(fixture.outputDir)).toBe(false)
  })

  it('prints purpose-specific Podman network names for explicit jobs', () => {
    const fixture = createFixture(releaseEnv())
    const result = runHelper(
      ['print-network', '--topology', 'single-node', '--purpose', 'database'],
      fixture,
    )

    expect(result.status).toBe(0)
    expect(result.stdout).toBe('kravhantering-single-node_database\n')

    const ambiguous = runHelper(
      ['print-network', '--topology', 'single-node'],
      fixture,
    )
    expect(ambiguous.status).not.toBe(0)
    expect(ambiguous.stderr).toContain(
      '--purpose is required with print-network',
    )
  })

  it('renders bounded resource and disk-backed export overrides', () => {
    const exportPath = path.join(os.tmpdir(), 'kh-export-private')
    fs.mkdirSync(exportPath, { recursive: true, mode: 0o700 })
    temporaryDirectories.push(exportPath)
    const fixture = createFixture(
      releaseEnv({
        APP_RUNTIME_CPU_QUOTA_PERCENT: '250',
        APP_RUNTIME_EXPORT_HOST_PATH: exportPath,
        APP_RUNTIME_EXPORT_STORAGE: 'bind',
        APP_RUNTIME_LOG_RATE_BURST: '3000',
        APP_RUNTIME_MEMORY_LIMIT_MIB: '6144',
        APP_RUNTIME_PIDS_LIMIT: '640',
        NGINX_CACHE_TMPFS_MIB: '96',
        NGINX_CPU_QUOTA_PERCENT: '75',
        NGINX_MEMORY_LIMIT_MIB: '768',
        NGINX_PIDS_LIMIT: '192',
      }),
    )
    const units = render('app-node-tls', fixture)
    const appRuntime = units.find(
      unit => unit.file === 'kravhantering-app-runtime.container',
    )?.content
    const nginx = units.find(
      unit => unit.file === 'kravhantering-nginx.container',
    )?.content

    expect(appRuntime).toContain(
      `Volume=${exportPath}:/run/kravhantering/export:rw,Z,nosuid,nodev,noexec`,
    )
    expect(appRuntime).not.toContain('Tmpfs=/run/kravhantering/export:')
    expect(appRuntime).toContain('MemoryMax=6144M')
    expect(appRuntime).toContain('CPUQuota=250%')
    expect(appRuntime).toContain('PidsLimit=640')
    expect(appRuntime).toContain('TasksMax=672')
    expect(appRuntime).toContain('LogRateLimitBurst=3000')
    expect(nginx).toContain('MemoryMax=768M')
    expect(nginx).toContain('CPUQuota=75%')
    expect(nginx).toContain('PidsLimit=192')
    expect(nginx).toContain('TasksMax=224')
    expect(nginx).toContain(
      'Tmpfs=/var/cache/nginx:rw,size=96M,mode=0750,uid=101,gid=101,nosuid,nodev,noexec',
    )
  })

  it.each([
    ['APP_RUNTIME_MEMORY_LIMIT_MIB', '4095'],
    ['APP_RUNTIME_EXPORT_STORAGE', 'shared'],
    ['APP_RUNTIME_EXPORT_TMPFS_MIB', '512'],
    ['APP_RUNTIME_PIDS_LIMIT', '64'],
    ['NGINX_MEMORY_LIMIT_MIB', '2048'],
    ['NGINX_CACHE_TMPFS_MIB', '8'],
    ['NGINX_PIDS_LIMIT', '0'],
    ['APP_RUNTIME_LOG_RATE_BURST', 'lots'],
  ])('rejects invalid bounded override %s=%s', (key, value) => {
    const fixture = createFixture(releaseEnv({ [key]: value }))
    const result = runHelper(
      [
        'render',
        '--topology',
        'app-node-tls',
        '--output-dir',
        fixture.outputDir,
      ],
      fixture,
    )

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(`invalid ${key}`)
    expect(fs.existsSync(fixture.outputDir)).toBe(false)
  })

  it('rejects combined CPU quotas above the topology capacity', () => {
    const fixture = createFixture(
      releaseEnv({ APP_RUNTIME_CPU_QUOTA_PERCENT: '400' }),
    )
    const result = runHelper(
      [
        'render',
        '--topology',
        'app-node-tls',
        '--output-dir',
        fixture.outputDir,
      ],
      fixture,
    )

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(
      'CPU quota combination: exceeds topology CPU capacity',
    )
  })

  it('installs Quadlet resources and the topology target in systemd paths', () => {
    const fixture = createFixture(releaseEnv())
    const quadletDir = path.join(fixture.outputDir, 'containers')
    const systemdDir = path.join(fixture.outputDir, 'systemd')
    fs.mkdirSync(quadletDir, { recursive: true })
    fs.mkdirSync(systemdDir, { recursive: true })
    fs.writeFileSync(
      path.join(quadletDir, 'kravhantering-sqlserver.container'),
      'stale topology unit\n',
    )
    fs.writeFileSync(
      path.join(systemdDir, 'kravhantering-single-node.target'),
      'stale topology target\n',
    )
    fs.writeFileSync(
      path.join(quadletDir, 'operator-owned.container'),
      'unmanaged\n',
    )
    fs.writeFileSync(
      path.join(systemdDir, 'operator-owned.target'),
      'unmanaged\n',
    )
    const result = runHelper(
      ['install', '--topology', 'app-node-tls'],
      fixture,
      {
        KRAVHANTERING_QUADLET_DIR: quadletDir,
        KRAVHANTERING_SYSTEMD_USER_DIR: systemdDir,
      },
    )

    expect(result.status).toBe(0)
    expect(fs.readdirSync(quadletDir).sort()).toEqual([
      'kravhantering-app-node-edge.network',
      'kravhantering-app-node-egress.network',
      'kravhantering-app-runtime.container',
      'kravhantering-nginx.container',
      'operator-owned.container',
    ])
    expect(fs.readdirSync(systemdDir).sort()).toEqual([
      'kravhantering-app-node.target',
      'operator-owned.target',
    ])
    expect(
      fs.statSync(path.join(quadletDir, 'kravhantering-nginx.container')).mode &
        0o777,
    ).toBe(0o644)
  })

  it('leaves active units unchanged when host enforcement preflight fails', () => {
    const fixture = createFixture(releaseEnv())
    const quadletDir = path.join(fixture.outputDir, 'containers')
    const systemdDir = path.join(fixture.outputDir, 'systemd')
    const missingControllers = path.join(fixture.root, 'missing.controllers')
    fs.writeFileSync(missingControllers, 'cpu pids\n')
    fs.mkdirSync(quadletDir, { recursive: true })
    fs.mkdirSync(systemdDir, { recursive: true })
    fs.writeFileSync(
      path.join(quadletDir, 'kravhantering-nginx.container'),
      'active nginx unit\n',
    )

    const result = runHelper(
      ['install', '--topology', 'app-node-tls'],
      fixture,
      {
        KRAVHANTERING_CGROUP_CONTROLLERS_FILE: missingControllers,
        KRAVHANTERING_QUADLET_DIR: quadletDir,
        KRAVHANTERING_SYSTEMD_USER_DIR: systemdDir,
      },
    )

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(
      'delegated cgroup controllers are missing: memory',
    )
    expect(
      fs.readFileSync(
        path.join(quadletDir, 'kravhantering-nginx.container'),
        'utf8',
      ),
    ).toBe('active nginx unit\n')
  })

  it('rejects host memory that cannot enforce the topology envelope', () => {
    const fixture = createFixture(releaseEnv())
    const lowMemory = path.join(fixture.root, 'low-memory')
    fs.writeFileSync(lowMemory, 'MemTotal:       8388608 kB\n')

    const result = runHelper(
      ['verify-host', '--topology', 'single-node'],
      fixture,
      { KRAVHANTERING_MEMINFO_FILE: lowMemory },
    )

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(
      'single-node memory limits leave less than 8 GiB',
    )
  })

  it('rejects journald automatic sizing as an explicit retention bound', () => {
    const fixture = createFixture(releaseEnv())
    fs.writeFileSync(
      path.join(fixture.root, 'journald.conf.d', 'limits.conf'),
      '[Journal]\nSystemMaxUse=auto\n',
    )

    const result = runHelper(
      ['verify-host', '--topology', 'app-node-tls'],
      fixture,
    )

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(
      'finite journald retention is not configured',
    )
  })

  it('uses the final journald drop-in values when checking retention', () => {
    const fixture = createFixture(releaseEnv())
    fs.renameSync(
      path.join(fixture.root, 'journald.conf.d', 'limits.conf'),
      path.join(fixture.root, 'journald.conf.d', '10-limits.conf'),
    )
    fs.writeFileSync(
      path.join(fixture.root, 'journald.conf.d', '90-automatic.conf'),
      '[Journal]\nSystemMaxUse=auto\nSystemKeepFree=auto\n',
    )

    const result = runHelper(
      ['verify-host', '--topology', 'app-node-tls'],
      fixture,
    )

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(
      'finite journald retention is not configured',
    )
  })

  it('leaves active units unchanged when replacement staging fails', () => {
    const fixture = createFixture(releaseEnv())
    const quadletDir = path.join(fixture.outputDir, 'containers')
    const systemdDir = path.join(fixture.outputDir, 'systemd')
    const mockBin = path.join(fixture.root, 'bin')
    fs.mkdirSync(quadletDir, { recursive: true })
    fs.mkdirSync(systemdDir, { recursive: true })
    fs.mkdirSync(mockBin)
    fs.writeFileSync(
      path.join(quadletDir, 'kravhantering-nginx.container'),
      'active nginx unit\n',
    )
    fs.writeFileSync(
      path.join(systemdDir, 'kravhantering-app-node.target'),
      'active target\n',
    )
    fs.writeFileSync(
      path.join(mockBin, 'cp'),
      [
        '#!/usr/bin/env bash',
        'case "$2" in',
        '  */kravhantering-nginx.container) exit 42 ;;',
        '  *) exec /bin/cp "$@" ;;',
        'esac',
        '',
      ].join('\n'),
      { mode: 0o755 },
    )

    const result = runHelper(
      ['install', '--topology', 'app-node-tls'],
      fixture,
      {
        KRAVHANTERING_QUADLET_DIR: quadletDir,
        KRAVHANTERING_SYSTEMD_USER_DIR: systemdDir,
        PATH: `${mockBin}:${process.env.PATH}`,
      },
    )

    expect(result.status).not.toBe(0)
    expect(
      fs.readFileSync(
        path.join(quadletDir, 'kravhantering-nginx.container'),
        'utf8',
      ),
    ).toBe('active nginx unit\n')
    expect(
      fs.readFileSync(
        path.join(systemdDir, 'kravhantering-app-node.target'),
        'utf8',
      ),
    ).toBe('active target\n')
    expect(fs.readdirSync(quadletDir)).toEqual([
      'kravhantering-nginx.container',
    ])
    expect(fs.readdirSync(systemdDir)).toEqual([
      'kravhantering-app-node.target',
    ])
  })

  it('stops and disables a topology before removal, then reloads systemd', () => {
    const fixture = createFixture(releaseEnv())
    const quadletDir = path.join(fixture.outputDir, 'containers')
    const systemdDir = path.join(fixture.outputDir, 'systemd')
    const mockBin = path.join(fixture.root, 'bin')
    const systemctlLog = path.join(fixture.root, 'systemctl.log')
    fs.mkdirSync(quadletDir, { recursive: true })
    fs.mkdirSync(systemdDir, { recursive: true })
    fs.mkdirSync(mockBin)
    fs.writeFileSync(
      path.join(quadletDir, 'kravhantering-nginx.container'),
      'managed\n',
    )
    fs.writeFileSync(
      path.join(systemdDir, 'kravhantering-single-node.target'),
      'managed\n',
    )
    fs.writeFileSync(
      path.join(mockBin, 'systemctl'),
      [
        '#!/usr/bin/env bash',
        'printf \'%s\\n\' "$*" >>"$SYSTEMCTL_LOG"',
        'if [[ "$*" == "--user daemon-reload" ]]; then',
        '  [[ ! -e "$KRAVHANTERING_QUADLET_DIR/kravhantering-nginx.container" ]]',
        '  [[ ! -e "$KRAVHANTERING_SYSTEMD_USER_DIR/kravhantering-single-node.target" ]]',
        'fi',
        '',
      ].join('\n'),
      { mode: 0o755 },
    )

    const result = runHelper(['remove', '--topology', 'single-node'], fixture, {
      KRAVHANTERING_QUADLET_DIR: quadletDir,
      KRAVHANTERING_SYSTEMD_USER_DIR: systemdDir,
      PATH: `${mockBin}:${process.env.PATH}`,
      SYSTEMCTL_LOG: systemctlLog,
    })

    expect(result.status).toBe(0)
    expect(fs.readFileSync(systemctlLog, 'utf8')).toBe(
      [
        '--user stop kravhantering-single-node.target',
        '--user disable kravhantering-single-node.target',
        '--user daemon-reload',
        '',
      ].join('\n'),
    )
    expect(result.stdout).toContain(
      `Removed managed unit files from ${quadletDir} and ${systemdDir}; named volumes remain.`,
    )
    expect(result.stdout).toContain('Reloaded the user systemd manager.')
  })
})
