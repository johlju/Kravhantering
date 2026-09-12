// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const image = process.env.KRAVHANTERING_DEMO_SEED_IMAGE

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

describe.skipIf(!image)('built opt-in demo seed', { timeout: 30_000 }, () => {
  it('provides its seed modules under the supported identity and containment', () => {
    const result = run(
      [
        '--input-type=module',
        '-e',
        `
        import fs from 'node:fs'
        await import('./typeorm/seed.mjs')
        for (const name of ['mssql', 'reflect-metadata', 'typeorm']) await import(name)
        fs.writeFileSync('/tmp/demo-contract', 'allowed')
        let denied
        try { fs.writeFileSync('/workspace/forbidden', 'forbidden') } catch (error) { denied = error.code }
        console.log(JSON.stringify({
          major: Number(process.versions.node.split('.')[0]),
          uid: process.getuid(), gid: process.getgid(), cwd: process.cwd(),
          owner: [fs.statSync('typeorm/seed.mjs').uid, fs.statSync('typeorm/seed.mjs').gid],
          temporary: fs.readFileSync('/tmp/demo-contract', 'utf8'), denied,
          npm: fs.existsSync('/usr/bin/npm') || fs.existsSync('/usr/local/bin/npm'),
        }))
      `,
      ],
      ['--entrypoint=node'],
    )
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual({
      major: 24,
      uid: 1000,
      gid: 1000,
      cwd: '/workspace',
      owner: [1000, 1000],
      temporary: 'allowed',
      denied: 'EROFS',
      npm: false,
    })
  })

  it('supports the administrative user override', () => {
    const result = run(
      [
        '-e',
        'console.log(JSON.stringify([process.getuid(),process.getgid()]))',
      ],
      ['--entrypoint=node', '--user=0:0'],
    )
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(JSON.parse(result.stdout)).toEqual([0, 0])
  })

  it('rejects demo clear without explicit destructive confirmation', () => {
    const result = run(['demo:clear'])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      'demo:clear requires --confirm-clear-non-required-data.',
    )
  })

  it('executes the default seed command and requires database configuration', () => {
    const result = run()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('DATABASE_URL')
  })
})
