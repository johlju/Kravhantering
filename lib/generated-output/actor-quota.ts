import { Worker } from 'node:worker_threads'
import {
  admitExportActor,
  releaseExportActor,
} from '@/lib/dal/export-actor-quota'
import type { SqlServerDatabase } from '@/lib/db'
import {
  GeneratedOutputError,
  type GeneratedOutputKind,
} from '@/lib/generated-output/errors'
import { recordCapacityEvent } from '@/lib/observability/capacity'
import type { RequestContext } from '@/lib/requirements/auth'
import { requirementResponsibilityPersonTargetFingerprint } from '@/lib/requirements/responsibility-person-verification'

// Generation is at most 600 seconds, leaving 120 seconds for delivery.
// A separate thread fences a stuck node before SQL's 900-second recovery.
const OPERATION_LIFETIME_MS = 720_000
const FAIL_STOP_MS = 840_000

type OutputResult = Response | { response: Response }

export async function runWithExportActorQuota<T extends OutputResult>(
  db: SqlServerDatabase,
  context: RequestContext,
  output: GeneratedOutputKind,
  requestSignal: AbortSignal | undefined,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const startedAt = process.hrtime.bigint()
  const controller = new AbortController()
  const signal = requestSignal
    ? AbortSignal.any([requestSignal, controller.signal])
    : controller.signal
  const unavailable = () =>
    new GeneratedOutputError(
      'quota_check_unavailable',
      'quota_check_unavailable',
      { output, retryAfterSeconds: 5 },
    )
  let watchdog: Worker | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let id: string | undefined
  let finished = false
  const recordFailure = (error: GeneratedOutputError) =>
    recordCapacityEvent({
      correlationId: context.correlationId,
      requestId: context.requestId,
      source: context.source,
      capacityReason: error.capacityReason,
      event:
        error.status === 429
          ? 'capacity.throttled'
          : 'capacity.operation.failed',
      operation: 'generated_output.actor_admission',
      outcome: error.status === 429 ? 'throttled' : 'failure',
      retryAfterSeconds: error.details.retryAfterSeconds,
      statusCode: error.status,
      surface: 'export',
    })
  const finish = async () => {
    if (finished) return
    finished = true
    clearTimeout(timer)
    await watchdog?.terminate()
    if (id) {
      try {
        await releaseExportActor(db, id)
      } catch {
        recordFailure(unavailable())
      }
    }
  }
  try {
    signal.throwIfAborted()
    timer = setTimeout(
      () =>
        controller.abort(
          new GeneratedOutputError('generation_timeout', 'generation_timeout', {
            output,
            timeoutSeconds: 600,
          }),
        ),
      OPERATION_LIFETIME_MS,
    )
    timer.unref()
    let admission: Awaited<ReturnType<typeof admitExportActor>>
    try {
      if (!context.actor.isAuthenticated || !context.actor.hsaId)
        throw unavailable()
      admission = await admitExportActor(
        db,
        requirementResponsibilityPersonTargetFingerprint(context.actor.hsaId),
      )
    } catch {
      throw unavailable()
    }
    if (!admission.allowed)
      throw new GeneratedOutputError(admission.reason, admission.reason, {
        output,
        activeLimit:
          admission.reason === 'actor_concurrency_limit'
            ? admission.limit
            : undefined,
        retryAfterSeconds: admission.retryAfterSeconds,
      })
    id = admission.id
    recordCapacityEvent({
      correlationId: context.correlationId,
      requestId: context.requestId,
      source: context.source,
      operation: 'generated_output.actor_admission',
      event: 'capacity.operation.completed',
      outcome: 'success',
      statusCode: 200,
      surface: 'export',
    })
    // Arm a fail-stop fence only for admitted work. Its absolute monotonic
    // deadline starts before SQL, so delayed worker startup cannot extend it.
    watchdog = new Worker(
      `
      const { workerData, parentPort } = require('node:worker_threads');
      const remaining = Number(BigInt(workerData) - process.hrtime.bigint()) / 1e6;
      setTimeout(() => process.kill(process.pid, 'SIGKILL'), Math.max(0, remaining));
      parentPort.postMessage('armed');
    `,
      {
        eval: true,
        workerData: String(
          startedAt + BigInt(FAIL_STOP_MS) * BigInt(1_000_000),
        ),
      },
    )
    await new Promise<void>((resolve, reject) => {
      watchdog?.once('message', () => resolve())
      watchdog?.once('error', reject)
    })
    watchdog.unref()
    if (
      process.hrtime.bigint() - startedAt >=
      BigInt(OPERATION_LIFETIME_MS) * BigInt(1_000_000)
    )
      controller.abort(unavailable())

    signal.throwIfAborted()
    const result = await work(signal)
    const response = result instanceof Response ? result : result.response
    if (signal.aborted) {
      await response.body?.cancel()
      signal.throwIfAborted()
    }
    if (!response.body) {
      await finish()
      return result
    }
    const reader = response.body.getReader()
    let closed = false
    let abort: (() => void) | undefined
    const body = new ReadableStream<Uint8Array>({
      start(stream) {
        abort = () => {
          if (closed) return
          closed = true
          stream.error(signal.reason)
          void reader
            .cancel(signal.reason)
            .finally(finish)
            .catch(() => {})
        }
        signal.addEventListener('abort', abort, { once: true })
        if (signal.aborted) abort()
      },
      async pull(stream) {
        try {
          const chunk = await reader.read()
          if (closed) return
          if (chunk.done) {
            closed = true
            if (abort) signal.removeEventListener('abort', abort)
            await finish()
            stream.close()
          } else stream.enqueue(chunk.value)
        } catch (error) {
          if (!closed) {
            closed = true
            stream.error(error)
          }
          if (abort) signal.removeEventListener('abort', abort)
          await finish()
        }
      },
      async cancel(reason) {
        closed = true
        if (abort) signal.removeEventListener('abort', abort)
        try {
          await reader.cancel(reason)
        } finally {
          await finish()
        }
      },
    })
    const held = new Response(body, {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    })
    return (
      result instanceof Response ? held : { ...result, response: held }
    ) as T
  } catch (error) {
    if (error instanceof GeneratedOutputError) recordFailure(error)
    await finish()
    throw error
  }
}
