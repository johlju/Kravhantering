import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SqlServerDatabase } from '@/lib/db'
import { runWithExportActorQuota } from '@/lib/generated-output/actor-quota'
import type { RequestContext } from '@/lib/requirements/auth'

const store = vi.hoisted(() => ({ admit: vi.fn(), release: vi.fn() }))
vi.mock('@/lib/dal/export-actor-quota', () => ({
  admitExportActor: store.admit,
  releaseExportActor: store.release,
}))
vi.mock('@/lib/requirements/responsibility-person-verification', () => ({
  requirementResponsibilityPersonTargetFingerprint: (id: string) =>
    id.trim().toLowerCase(),
}))
const context = {
  actor: {
    isAuthenticated: true,
    hsaId: 'SE1234567890-ALICE',
    roles: ['admin'],
  },
  source: 'rest',
  requestId: 'request',
  correlationId: 'correlation',
} as RequestContext
const db = {} as SqlServerDatabase

describe('Export actor admission lifecycle', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })
  beforeEach(() => {
    vi.clearAllMocks()
    store.admit.mockResolvedValue({ allowed: true, id: 'admission' })
    store.release.mockResolvedValue(undefined)
  })
  it('fails closed before collection when SQL is unavailable', async () => {
    store.admit.mockRejectedValue(new Error('SQL host secret'))
    const collect = vi.fn()
    await expect(
      runWithExportActorQuota(db, context, 'pdf', undefined, collect),
    ).rejects.toMatchObject({ code: 'quota_check_unavailable', status: 503 })
    expect(collect).not.toHaveBeenCalled()
    expect(store.release).not.toHaveBeenCalled()
  })
  it.each([
    { isAuthenticated: false, hsaId: 'person' },
    { isAuthenticated: true, hsaId: '' },
  ])(
    'requires an authenticated actor with an HSA identity: %j',
    async actor => {
      const collect = vi.fn()
      await expect(
        runWithExportActorQuota(
          db,
          { ...context, actor } as RequestContext,
          'csv',
          undefined,
          collect,
        ),
      ).rejects.toMatchObject({ code: 'quota_check_unavailable' })
      expect(store.admit).not.toHaveBeenCalled()
      expect(collect).not.toHaveBeenCalled()
    },
  )
  it('releases a response without a body before consumption', async () => {
    const response = await runWithExportActorQuota(
      db,
      context,
      'json',
      undefined,
      async () => new Response(null, { status: 204 }),
    )
    expect(response.status).toBe(204)
    expect(store.release).toHaveBeenCalledExactlyOnceWith(db, 'admission')
  })
  it('rejects a delayed admission after its total operation lifetime', async () => {
    const now = process.hrtime.bigint()
    vi.spyOn(process.hrtime, 'bigint')
      .mockReturnValueOnce(now)
      .mockReturnValueOnce(now + BigInt(721_000_000_000))
    const work = vi.fn()
    await expect(
      runWithExportActorQuota(db, context, 'csv', undefined, work),
    ).rejects.toMatchObject({ code: 'quota_check_unavailable' })
    expect(work).not.toHaveBeenCalled()
    expect(store.release).toHaveBeenCalledExactlyOnceWith(db, 'admission')
  })
  it('preserves delivery when SQL release fails and leaves recovery conservative', async () => {
    store.release.mockRejectedValue(new Error('database unavailable'))
    const result = await runWithExportActorQuota(
      db,
      context,
      'csv',
      undefined,
      async () => ({
        response: new Response('payload'),
        filename: 'export.csv',
      }),
    )
    expect(result.filename).toBe('export.csv')
    expect(await result.response.text()).toBe('payload')
    expect(store.release).toHaveBeenCalledTimes(1)
  })
  it('charges the requesting person and holds active admission until streaming ends', async () => {
    const response = await runWithExportActorQuota(
      db,
      context,
      'json',
      undefined,
      async () => new Response('payload'),
    )
    expect(store.admit).toHaveBeenCalledWith(db, 'se1234567890-alice')
    expect(store.release).not.toHaveBeenCalled()
    expect(await response.text()).toBe('payload')
    expect(store.release).toHaveBeenCalledExactlyOnceWith(db, 'admission')
  })
  it('keeps cancelled collection active until the work settles and releases only once', async () => {
    const controller = new AbortController()
    let finish!: (response: Response) => void
    let start!: () => void
    const started = new Promise<void>(resolve => {
      start = resolve
    })
    const pending = runWithExportActorQuota(
      db,
      context,
      'csv',
      controller.signal,
      () =>
        new Promise<Response>(resolve => {
          finish = resolve
          start()
        }),
    )
    await started
    controller.abort()
    expect(store.release).not.toHaveBeenCalled()
    const rejected = expect(pending).rejects.toBeDefined()
    finish(new Response('discard'))
    await rejected
    expect(store.release).toHaveBeenCalledTimes(1)
  })
  it('releases on response cancellation and retains an admitted start on generation failure', async () => {
    const response = await runWithExportActorQuota(
      db,
      context,
      'csv',
      undefined,
      async () => new Response(new ReadableStream()),
    )
    await response.body?.cancel()
    expect(store.release).toHaveBeenCalledTimes(1)
    await expect(
      runWithExportActorQuota(db, context, 'pdf', undefined, async () => {
        throw new Error('renderer')
      }),
    ).rejects.toThrow('renderer')
    expect(store.release).toHaveBeenCalledTimes(2)
  })
  it('keeps timed out work admitted until cancellation cleanup settles', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    let finish!: (response: Response) => void
    let start!: () => void
    let operationSignal!: AbortSignal
    const started = new Promise<void>(resolve => {
      start = resolve
    })
    const pending = runWithExportActorQuota(
      db,
      context,
      'json',
      undefined,
      signal => {
        operationSignal = signal
        return new Promise<Response>(resolve => {
          finish = resolve
          start()
        })
      },
    )
    await started
    await vi.advanceTimersByTimeAsync(720_000)
    expect(operationSignal.aborted).toBe(true)
    expect(store.release).not.toHaveBeenCalled()
    const rejected = expect(pending).rejects.toMatchObject({
      code: 'generation_timeout',
    })
    finish(new Response(null))
    await rejected
    expect(store.release).toHaveBeenCalledExactlyOnceWith(db, 'admission')
  })
  it.each(['actor_rate_limit', 'actor_concurrency_limit'] as const)(
    'returns a distinct %s without starting work, including administrators',
    async reason => {
      store.admit.mockResolvedValue({
        allowed: false,
        reason,
        limit: 1,
        retryAfterSeconds: 12,
      })
      const work = vi.fn()
      await expect(
        runWithExportActorQuota(db, context, 'pdf', undefined, work),
      ).rejects.toMatchObject({ code: reason, status: 429 })
      expect(work).not.toHaveBeenCalled()
      expect(store.release).not.toHaveBeenCalled()
    },
  )
})
