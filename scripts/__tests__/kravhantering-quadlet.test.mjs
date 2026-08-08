import childProcess from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const SCRIPT_PATH = path.resolve(
  process.cwd(),
  'containers/production/bin/kravhantering-quadlet.sh',
)
const temporaryDirectories = []

function createFixture(releaseEnv) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kh-quadlet-'))
  temporaryDirectories.push(root)
  const releaseEnvPath = path.join(root, 'release.env')
  const outputDir = path.join(root, 'rendered')
  fs.writeFileSync(releaseEnvPath, releaseEnv)
  return { outputDir, releaseEnvPath }
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
      'kravhantering-app-node.network',
      'kravhantering-app-node.target',
      'kravhantering-app-runtime.container',
      'kravhantering-nginx.container',
    ])
    expect(
      units.find(unit => unit.file.endsWith('.network'))?.content,
    ).toContain('NetworkName=kravhantering-app-node_kravhantering-internal')
    const nginx = units.find(
      unit => unit.file === 'kravhantering-nginx.container',
    )?.content
    expect(nginx).toContain('Image=registry.example/nginx:1.31')
    expect(nginx).toContain('PublishPort=8443:443')
    expect(nginx).toContain('Environment=NGINX_RESOLVER=10.91.0.1')
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

  it('renders single-node service names, persistent volumes and hostname alias', () => {
    const fixture = createFixture(releaseEnv())
    const units = render('single-node', fixture)
    const allContent = units.map(unit => unit.content).join('\n')

    expect(units.map(unit => unit.file)).toEqual([
      'kravhantering-app-runtime.container',
      'kravhantering-keycloak-data.volume',
      'kravhantering-keycloak.container',
      'kravhantering-nginx.container',
      'kravhantering-single-node.network',
      'kravhantering-single-node.target',
      'kravhantering-sqlserver-data.volume',
      'kravhantering-sqlserver.container',
    ])
    expect(allContent).toContain(
      'NetworkName=kravhantering-single-node_kravhantering-internal',
    )
    expect(allContent).toContain('VolumeName=kravhantering-sqlserver-data')
    expect(allContent).toContain('VolumeName=kravhantering-keycloak-data')
    expect(allContent).toContain('NetworkAlias=kravhantering.example.internal')
    expect(allContent).toContain(
      'Volume=/etc/kravhantering/tls/ca.crt:/run/kravhantering/tls/ca.crt:ro',
    )
    expect(allContent).not.toMatch(
      /^(?:After|Requires)=.*\.(?:container|network|volume)(?:\s|$)/mu,
    )
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

  it('prints the stable Podman network name for explicit db-job operations', () => {
    const fixture = createFixture(releaseEnv())
    const result = runHelper(
      ['print-network', '--topology', 'single-node'],
      fixture,
    )

    expect(result.status).toBe(0)
    expect(result.stdout).toBe(
      'kravhantering-single-node_kravhantering-internal\n',
    )
  })

  it('installs Quadlet resources and the topology target in systemd paths', () => {
    const fixture = createFixture(releaseEnv())
    const quadletDir = path.join(fixture.outputDir, 'containers')
    const systemdDir = path.join(fixture.outputDir, 'systemd')
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
      'kravhantering-app-node.network',
      'kravhantering-app-runtime.container',
      'kravhantering-nginx.container',
    ])
    expect(fs.readdirSync(systemdDir)).toEqual([
      'kravhantering-app-node.target',
    ])
  })
})
