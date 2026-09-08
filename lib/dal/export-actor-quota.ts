import { randomUUID } from 'node:crypto'
import type { SqlServerDatabase } from '@/lib/db'

// The local fail-stop watchdog must terminate unsettled work before recovery.
export const EXPORT_ACTOR_RECOVERY_SECONDS = 900
export type ExportActorAdmission =
  | { allowed: true; id: string }
  | {
      allowed: false
      reason: 'actor_rate_limit' | 'actor_concurrency_limit'
      limit: number
      retryAfterSeconds?: number
    }

export async function admitExportActor(
  db: SqlServerDatabase,
  actorFingerprint: string,
): Promise<ExportActorAdmission> {
  if (!/^hfp_[A-Za-z0-9_-]{22}$/u.test(actorFingerprint))
    throw new Error('Invalid export actor fingerprint')
  const id = randomUUID()
  return db.transaction(async manager => {
    const rows = await manager.query<
      Array<{ reason: string; limit: number; retryAfterSeconds: number }>
    >(
      `
      DECLARE @lock_result int;
      EXEC @lock_result = sys.sp_getapplock
        @Resource = @0, @LockMode = N'Exclusive',
        @LockOwner = N'Transaction', @LockTimeout = 1000;
      IF @lock_result < 0 THROW 51065, 'Export quota coordination unavailable.', 1;
      DECLARE @now datetime2(3) = SYSUTCDATETIME();
      DECLARE @rate int, @active int;
      SELECT @rate = export_actor_starts_per_minute, @active = export_actor_concurrency
        FROM application_settings WHERE id = 1;
      IF @rate IS NULL OR @active IS NULL THROW 51065, 'Export quota settings unavailable.', 1;
      IF (SELECT COUNT(*) FROM export_actor_quota_entries
          WHERE actor_fingerprint = @1 AND released_at IS NULL AND expires_at > @now) >= @active
        SELECT N'actor_concurrency_limit' AS reason, @active AS limit;
      ELSE IF (SELECT COUNT(*) FROM export_actor_quota_entries
          WHERE actor_fingerprint = @1 AND created_at > DATEADD(second, -60, @now)) >= @rate
      BEGIN
        DECLARE @available_at datetime2(3);
        SELECT @available_at = DATEADD(second, 60, created_at)
          FROM export_actor_quota_entries WHERE actor_fingerprint = @1
            AND created_at > DATEADD(second, -60, @now)
          ORDER BY created_at DESC OFFSET (@rate - 1) ROWS FETCH NEXT 1 ROW ONLY;
        SELECT N'actor_rate_limit' AS reason, @rate AS limit,
          CONVERT(int, CEILING(DATEDIFF_BIG(millisecond, @now, @available_at) / 1000.0)) AS retryAfterSeconds;
      END
      ELSE BEGIN
        INSERT INTO export_actor_quota_entries (id, actor_fingerprint, created_at, expires_at)
          VALUES (@2, @1, @now, DATEADD(second, ${EXPORT_ACTOR_RECOVERY_SECONDS}, @now));
        SELECT N'admitted' AS reason;
      END`,
      [
        `kravhantering:export-actor:v1:${actorFingerprint}`,
        actorFingerprint,
        id,
      ],
    )
    const row = rows[0]
    if (row?.reason === 'admitted') return { allowed: true, id }
    if (row?.reason === 'actor_rate_limit')
      return {
        allowed: false,
        reason: row.reason,
        limit: row.limit,
        retryAfterSeconds: Math.max(1, row.retryAfterSeconds),
      }
    if (row?.reason === 'actor_concurrency_limit')
      return { allowed: false, reason: row.reason, limit: row.limit }
    throw new Error('Export quota decision unavailable')
  })
}

export async function releaseExportActor(
  db: SqlServerDatabase,
  id: string,
): Promise<void> {
  await db.query(
    `UPDATE export_actor_quota_entries SET released_at = SYSUTCDATETIME()
    WHERE id = @0 AND released_at IS NULL`,
    [id],
  )
}
