import {
  parseSpecificationItemRef,
  type SqlExecutor,
} from '@/lib/dal/requirements-specifications'
import type { RequestContext } from '@/lib/requirements/auth'
import { conflictError, notFoundError } from '@/lib/requirements/errors'
import { stockholmDate } from '@/lib/specifications/agreement-dates'
import { assertDeviationMutationAllowed } from '@/lib/specifications/agreement-deviation-policy'
import { applicableDeviationSql } from '@/lib/specifications/agreement-deviation-state'
import { deviationTables } from '@/lib/specifications/deviation-approval'

/** Called by the responsible-only agreement workflow inside its locked transaction. */
export async function closeApprovedDeviation(
  db: SqlExecutor,
  specificationId: number,
  context: RequestContext,
  input: {
    itemRef: string
    deviationId: number
    agreementId?: number
    reason: string
  },
  now: Date,
): Promise<void> {
  const ref = parseSpecificationItemRef(input.itemRef)
  if (!ref) throw notFoundError('Requirement not found')
  const kind = ref.kind === 'library' ? 'library' : 'local'
  const { cases, binding, items, parent, endingCase } = deviationTables(kind)
  const rows = await db.query<Array<{ id: number }>>(
    `SELECT deviation.id FROM ${cases} deviation INNER JOIN ${items} item ON item.id = deviation.${binding}
     WHERE deviation.id = @0 AND item.id = @1 AND item.${parent} = @2 AND deviation.decision = 1`,
    [input.deviationId, ref.id, specificationId],
  )
  if (!rows[0]) throw notFoundError('Approved deviation not found')
  await assertDeviationMutationAllowed(
    db,
    kind,
    input.deviationId,
    input.agreementId,
  )
  const previousClosure = await db.query<Array<{ id: number }>>(
    `SELECT id FROM specification_deviation_endings WHERE ${endingCase} = @0 AND ending_kind = 'closed' AND ended_at IS NOT NULL`,
    [input.deviationId],
  )
  if (previousClosure.length) return
  const applicable = await db.query<Array<{ id: number }>>(
    `SELECT deviation.id FROM ${cases} deviation
     WHERE deviation.id = @0 AND ${applicableDeviationSql(kind)}`,
    [input.deviationId],
  )
  if (!applicable.length)
    throw conflictError('Only an applicable approval can be closed', {
      reason: 'deviation_not_applicable',
    })
  const pending = await db.query<Array<{ id: number }>>(
    `SELECT id FROM ${cases} WHERE ${binding} = @0 AND decision IS NULL`,
    [ref.id],
  )
  if (pending.length)
    throw conflictError(
      'Cancel the pending renewal before closing permission',
      { reason: 'deviation_renewal_pending' },
    )
  const later = await db.query<Array<{ id: number }>>(
    `SELECT TOP (1) id FROM ${cases} WHERE ${binding} = @0 AND decision = 1 ORDER BY decided_at DESC, id DESC`,
    [ref.id],
  )
  if (later[0]?.id !== input.deviationId)
    throw conflictError('This approval has been replaced', {
      reason: 'deviation_superseded',
    })
  await db.query(
    `INSERT INTO specification_deviation_endings
      (specification_id, ${endingCase}, planned_effective_date, recorded_at, recorded_by_hsa_id,
       recorded_by_display_name, ended_at, ending_kind, reason)
     VALUES (@0, @1, @2, @3, @4, @5, @3, 'closed', @6)`,
    [
      specificationId,
      input.deviationId,
      stockholmDate(now),
      now,
      context.actor.hsaId,
      context.actor.displayName,
      input.reason.trim(),
    ],
  )
}
