import type { SqlServerDatabase } from '@/lib/db'
import type { RequestContext } from '@/lib/requirements/auth'

// Tests at the renderer/route seam use this adapter; admission has separate
// lifecycle tests and real SQL multi-connection coverage.
export function allowGeneratedOutput<T>(
  _db: SqlServerDatabase,
  _context: RequestContext,
  _output: string,
  signal: AbortSignal | undefined,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  return work(signal ?? new AbortController().signal)
}
