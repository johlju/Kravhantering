import type { TransientCleanupQueryExecutor } from './requirement-import-validation-sessions'
import type { TransientCleanupTarget } from './runner'

export function createExportActorQuotaCleanupTarget(
  executor: TransientCleanupQueryExecutor,
): TransientCleanupTarget {
  return {
    kind: 'export_actor_quota_entries',
    async inspect() {
      const rows = await executor.query<
        Array<{
          expiredRowCount: number | string
          expiredStoredBytes: number | string
          oldestExpiredAgeMs: number | string | null
        }>
      >(`
        SELECT COUNT_BIG(*) AS expiredRowCount,
          COALESCE(SUM(CONVERT(bigint, DATALENGTH(id) + DATALENGTH(actor_fingerprint) + DATALENGTH(created_at) + COALESCE(DATALENGTH(released_at), 0) + DATALENGTH(expires_at))), 0) AS expiredStoredBytes,
          DATEDIFF_BIG(millisecond, MIN(expires_at), SYSUTCDATETIME()) AS oldestExpiredAgeMs
        FROM export_actor_quota_entries WHERE expires_at <= SYSUTCDATETIME()`)
      const row = rows[0]
      if (!row) throw new Error('Export quota cleanup backlog unavailable')
      return {
        expiredRowCount: Number(row.expiredRowCount),
        expiredStoredBytes: Number(row.expiredStoredBytes),
        oldestExpiredAgeMs:
          row.oldestExpiredAgeMs === null
            ? null
            : Number(row.oldestExpiredAgeMs),
      }
    },
    async purgeBatch(limit) {
      const rows = await executor.query<Array<{ deletedRows: number }>>(
        `
        ;WITH expired AS (SELECT TOP (@0) id FROM export_actor_quota_entries
          WITH (UPDLOCK, READPAST, READCOMMITTEDLOCK, ROWLOCK)
          WHERE expires_at <= SYSUTCDATETIME() ORDER BY expires_at, id)
        DELETE FROM expired;
        SELECT @@ROWCOUNT AS deletedRows;`,
        [Math.max(1, Math.min(500, Math.trunc(limit)))],
      )
      return rows[0]
    },
  }
}
