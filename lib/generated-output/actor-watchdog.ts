import { Worker } from 'node:worker_threads'

/** Fence live work even when the main event loop cannot process its timeout. */
export async function armExportActorWatchdog(
  deadline: bigint,
): Promise<() => Promise<void>> {
  const watchdog = new Worker(
    `
      const { workerData, parentPort } = require('node:worker_threads');
      const remaining = Number(BigInt(workerData) - process.hrtime.bigint()) / 1e6;
      setTimeout(() => process.kill(process.pid, 'SIGKILL'), Math.max(0, remaining));
      parentPort.postMessage('armed');
    `,
    { eval: true, execArgv: [], workerData: String(deadline) },
  )
  await new Promise<void>((resolve, reject) => {
    watchdog.once('message', () => resolve())
    watchdog.once('error', reject)
    watchdog.once('exit', () =>
      reject(new Error('Actor watchdog exited before admission')),
    )
  })
  let disarmed = false
  // Losing an armed watchdog must not leave unfenced live work behind.
  watchdog.on('error', () => {
    if (!disarmed) process.kill(process.pid, 'SIGKILL')
  })
  watchdog.on('exit', () => {
    if (!disarmed) process.kill(process.pid, 'SIGKILL')
  })
  watchdog.unref()
  return async () => {
    disarmed = true
    await watchdog.terminate()
  }
}
