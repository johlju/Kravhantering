import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import type { SqlServerDatabase } from '@/lib/db'
import { runWithExportActorQuota } from '@/lib/generated-output/actor-quota'
import { createGeneratedOutputFileResponse } from '@/lib/generated-output/spool'
import type { RequestContext } from '@/lib/requirements/auth'

const mocks = vi.hoisted(() => ({ release: vi.fn() }))
vi.mock('@/lib/dal/export-actor-quota', () => ({
  admitExportActor: async () => ({ allowed: true, id: 'admission' }),
  releaseExportActor: mocks.release,
}))
vi.mock('@/lib/requirements/responsibility-person-verification', () => ({
  requirementResponsibilityPersonTargetFingerprint: () => 'fingerprint',
}))
const roots: string[] = []
afterEach(async () => {
  vi.clearAllMocks()
  await Promise.all(
    roots.splice(0).map(path => rm(path, { recursive: true, force: true })),
  )
})

it.each([false, true])(
  'holds the actor slot until error cleanup settles (cancel race: %s)',
  async cancel => {
    const root = await mkdtemp(join(tmpdir(), 'quota-stream-'))
    roots.push(root)
    const filePath = join(root, 'output')
    await writeFile(filePath, 'payload')
    let finishCleanup!: () => void
    const cleanup = new Promise<void>(resolve => {
      finishCleanup = resolve
    })
    const releaseSpool = vi.fn(() => cleanup)
    const controller = new AbortController()
    const response = await runWithExportActorQuota(
      {} as SqlServerDatabase,
      {
        actor: { isAuthenticated: true, hsaId: 'person' },
        source: 'rest',
      } as RequestContext,
      'csv',
      controller.signal,
      async () =>
        createGeneratedOutputFileResponse(
          {
            filePath,
            directoryPath: root,
            releaseGeneration: () => unlinkSync(filePath),
            releaseSpool,
          },
          {},
        ),
    )
    const reading = response.text().catch(() => undefined)
    await vi.waitFor(() => expect(releaseSpool).toHaveBeenCalledTimes(1))
    if (cancel) controller.abort(new Error('client disconnected'))
    await new Promise(resolve => setImmediate(resolve))
    expect(mocks.release).not.toHaveBeenCalled()
    finishCleanup()
    await reading
    await vi.waitFor(() => expect(mocks.release).toHaveBeenCalledTimes(1))
    expect(releaseSpool).toHaveBeenCalledTimes(1)
  },
)

import { unlinkSync } from 'node:fs'
