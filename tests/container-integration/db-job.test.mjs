// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const image = process.env.KRAVHANTERING_DB_JOB_IMAGE

function run(args = [], dockerArgs = []) {
  return spawnSync(
    'docker',
    [
      'run',
      '--rm',
      '--read-only',
      '--cap-drop=ALL',
      '--security-opt=no-new-privileges',
      '--tmpfs=/tmp:rw,size=64m,mode=1777',
      '--network=none',
      ...dockerArgs,
      image,
      ...args,
    ],
    { encoding: 'utf8', timeout: 30_000 },
  )
}

function node(script, dockerArgs = []) {
  const result = run(['-e', script], ['--entrypoint=node', ...dockerArgs])
  expect(result.stderr).toBe('')
  expect(result.status).toBe(0)
  return JSON.parse(result.stdout)
}

describe.skipIf(!image)('built database job', { timeout: 30_000 }, () => {
  it('retains the supported identity, dependency subset and filesystem containment', () => {
    expect(
      node(`
      const fs = require('node:fs')
      for (const name of ['mssql','reflect-metadata','typeorm']) require(name)
      fs.writeFileSync('/tmp/db-job-contract','allowed')
      let denied
      try {fs.writeFileSync('/workspace/forbidden','forbidden')} catch(error) {denied=error.code}
      console.log(JSON.stringify({
        major: Number(process.versions.node.split('.')[0]),
        uid: process.getuid(), gid: process.getgid(), cwd: process.cwd(),
        owner: [fs.statSync('scripts/db-sqlserver-admin.mjs').uid, fs.statSync('scripts/db-sqlserver-admin.mjs').gid],
        temporary: fs.readFileSync('/tmp/db-job-contract','utf8'), denied,
        demo: fs.existsSync('typeorm/seed.mjs'),
        applicationPackages: ['next', 'react'].filter(name => fs.existsSync('node_modules/' + name)),
        npm: fs.existsSync('/usr/bin/npm') || fs.existsSync('/usr/local/bin/npm'),
      }))
    `),
    ).toEqual({
      major: 24,
      uid: 1000,
      gid: 1000,
      cwd: '/workspace',
      owner: [1000, 1000],
      temporary: 'allowed',
      denied: 'EROFS',
      demo: false,
      applicationPackages: [],
      npm: false,
    })
    expect(
      node('console.log(JSON.stringify([process.getuid(),process.getgid()]))', [
        '--user=0:0',
      ]),
    ).toEqual([0, 0])
  })

  it('executes the compiled cleanup payload through the production absolute Node path', () => {
    const result = run(
      ['transient-cleanup/lib/transient-cleanup/cli.js', '--help'],
      ['--entrypoint=/usr/local/bin/node'],
    )
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain('--compatibility-evidence')
    const rejected = run(
      ['transient-cleanup/lib/transient-cleanup/cli.js', '--invalid'],
      ['--entrypoint=/usr/local/bin/node'],
    )
    expect(rejected.status).toBe(1)
    expect(JSON.parse(rejected.stdout)).toMatchObject({
      event: 'transient_cleanup.run.completed',
      outcome: 'failure',
      failure_code: 'runner_execution_failed',
    })
  })

  it.each(['seed:demo', 'demo:clear', 'setup'])(
    'rejects %s outside the production database job role',
    command => {
      const result = run([command])
      expect(result.status).toBe(1)
      expect(result.stderr).toContain(
        `${command} is only available from local source workflows or the kravhantering-demo-seed image.`,
      )
    },
  )

  it('preserves the default health command and rejects missing database configuration', () => {
    const result = run()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('DATABASE_URL')
  })
})
