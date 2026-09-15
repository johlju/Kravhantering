import type { SqlExecutor } from '@/lib/dal/requirements-specifications'
import { conflictError } from '@/lib/requirements/errors'
import { stockholmDate } from '@/lib/specifications/agreement-dates'

export function deviationTables(kind: 'library' | 'local'): {
  cases: string
  binding: string
  items: string
  parent: string
  endingCase: string
} {
  return kind === 'library'
    ? {
        cases: 'deviations',
        binding: 'specification_item_id',
        items: 'requirements_specification_items',
        parent: 'requirements_specification_id',
        endingCase: 'deviation_id',
      }
    : {
        cases: 'specification_local_requirement_deviations',
        binding: 'specification_local_requirement_id',
        items: 'specification_local_requirements',
        parent: 'specification_id',
        endingCase: 'local_deviation_id',
      }
}

/** The caller holds the specification lock and the ordinary new-request guard. */
export async function assertRenewalTarget(
  db: SqlExecutor,
  kind: 'library' | 'local',
  itemId: number,
  renewsDeviationId: number | undefined,
): Promise<void> {
  if (renewsDeviationId === undefined) return
  const { cases, binding, endingCase } = deviationTables(kind)
  const latest = await db.query<Array<{ id: number; isClosed: number }>>(
    `SELECT TOP (1) approval.id,
       CASE WHEN EXISTS (SELECT 1 FROM specification_deviation_endings ending
         WHERE ending.${endingCase} = approval.id AND ending.ending_kind = 'closed'
           AND ending.ended_at IS NOT NULL) THEN 1 ELSE 0 END AS isClosed
     FROM ${cases} approval WHERE approval.${binding} = @0 AND approval.decision = 1
     ORDER BY approval.decided_at DESC, approval.id DESC`,
    [itemId],
  )
  if (latest[0]?.id !== renewsDeviationId)
    throw conflictError(
      'Renewal must refer to the latest approval of this exact content',
      { reason: 'deviation_renewal_target' },
    )
  if (latest[0].isClosed)
    throw conflictError('Closed approval requires a new deviation request', {
      reason: 'deviation_approval_closed',
    })
}

/** Replacement and inherited ending plans commit with the new decision. */
export async function preserveApprovalReplacement(
  db: SqlExecutor,
  kind: 'library' | 'local',
  deviationId: number,
  actorHsaId: string,
  now: Date,
): Promise<void> {
  const { cases, binding, items, parent, endingCase } = deviationTables(kind)
  await db.query(
    `INSERT INTO specification_deviation_endings
      (specification_id, agreement_id, agreement_reference, agreement_item_id, ${endingCase},
       planned_effective_date, recorded_at, recorded_by_hsa_id)
     SELECT DISTINCT ending.specification_id, ending.agreement_id, ending.agreement_reference,
       ending.agreement_item_id, @0, ending.planned_effective_date, @1, @2
     FROM specification_deviation_endings ending
     INNER JOIN ${cases} previous ON previous.id = ending.${endingCase}
     INNER JOIN ${cases} replacement ON replacement.${binding} = previous.${binding} AND replacement.id = @0
     WHERE ending.cancelled_at IS NULL AND ending.ended_at IS NULL AND previous.id <> @0`,
    [deviationId, now, actorHsaId],
  )
  await db.query(
    `INSERT INTO specification_deviation_endings
      (specification_id, ${endingCase}, planned_effective_date, recorded_at, recorded_by_hsa_id, ended_at, ending_kind)
     SELECT item.${parent}, previous.id, @1, @2, @3, @2, 'superseded'
     FROM ${cases} previous INNER JOIN ${items} item ON item.id = previous.${binding}
     INNER JOIN ${cases} replacement ON replacement.${binding} = previous.${binding} AND replacement.id = @0
     WHERE previous.id <> @0 AND previous.decision = 1 AND NOT EXISTS
       (SELECT 1 FROM specification_deviation_endings ending WHERE ending.${endingCase} = previous.id AND ending.ended_at IS NOT NULL)`,
    [deviationId, stockholmDate(now), now, actorHsaId],
  )
}
