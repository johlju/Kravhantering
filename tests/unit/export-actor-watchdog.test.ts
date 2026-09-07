// @vitest-environment node
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, it } from 'vitest'

const moduleUrl = pathToFileURL(
  resolve('lib/generated-output/actor-watchdog.ts'),
).href

async function runChild(work: string) {
  const child = spawn(
    process.execPath,
    [
      '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
      '--input-type=module',
      '--eval',
      `
    import { armExportActorWatchdog } from ${JSON.stringify(moduleUrl)};
    const stop = await armExportActorWatchdog(process.hrtime.bigint() + 500_000_000n);
    process.stdout.write('armed\\n');
    ${work}
  `,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )
  let output = ''
  let error = ''
  child.stdout.on('data', chunk => {
    output += chunk
  })
  child.stderr.on('data', chunk => {
    error += chunk
  })
  const timeout = setTimeout(() => child.kill('SIGTERM'), 4000)
  try {
    const result = await new Promise<{
      code: number | null
      signal: NodeJS.Signals | null
    }>((resolve, reject) => {
      child.once('error', reject)
      child.once('exit', (code, signal) => resolve({ code, signal }))
    })
    return { ...result, output, error }
  } finally {
    clearTimeout(timeout)
    child.kill()
  }
}

it('fences live work with SIGKILL despite a blocked main event loop', async () => {
  const result = await runChild(
    'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);',
  )
  expect(result.output).toBe('armed\n')
  expect(result.error).toBe('')
  expect(result.signal).toBe('SIGKILL')
  expect(result.code).toBeNull()
})

it('disarms after settled work so the process survives the recovery fence', async () => {
  const result = await runChild(
    "await stop(); setTimeout(() => process.stdout.write('survived\\n'), 650);",
  )
  expect(result.output).toBe('armed\nsurvived\n')
  expect(result.error).toBe('')
  expect(result.signal).toBeNull()
  expect(result.code).toBe(0)
})
