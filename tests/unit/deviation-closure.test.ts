import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RequestContext } from '@/lib/requirements/auth'
import { conflictError } from '@/lib/requirements/errors'
import { assertDeviationMutationAllowed } from '@/lib/specifications/agreement-deviation-policy'
import { closeApprovedDeviation } from '@/lib/specifications/deviation-closure'

vi.mock('@/lib/specifications/agreement-deviation-policy', () => ({
  assertDeviationMutationAllowed: vi.fn(),
}))

const context = {
  actor: { hsaId: 'SE5560000001-owner', displayName: 'Owner' },
} as RequestContext
const now = new Date('2026-09-15T22:30:00Z')
const input = {
  itemRef: 'lib:3',
  deviationId: 10,
  agreementId: 7,
  reason: "  Owner's closure reason  ",
}

function setup(results: unknown[][]) {
  const query = vi.fn()
  for (const rows of results) query.mockResolvedValueOnce(rows)
  query.mockResolvedValue([])
  return { query }
}

describe('close approved deviation inside the agreement transaction', () => {
  beforeEach(() => vi.resetAllMocks())

  it.each([
    ['lib:3', 'deviations', 'deviation_id', 'requirements_specification_id'],
    [
      'local:3',
      'specification_local_requirement_deviations',
      'local_deviation_id',
      'specification_id',
    ],
  ])(
    'records closure for %s with bound actor, reason and Stockholm date',
    async (itemRef, table, endingKey, parent) => {
      const db = setup([[{ id: 10 }], [], [{ id: 10 }], [], [{ id: 10 }]])
      await closeApprovedDeviation(db, 2, context, { ...input, itemRef }, now)
      expect(db.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining(`FROM ${table}`),
        [10, 3, 2],
      )
      expect(db.query.mock.calls[0][0]).toContain(`item.${parent} = @2`)
      expect(assertDeviationMutationAllowed).toHaveBeenCalledWith(
        db,
        itemRef.startsWith('lib:') ? 'library' : 'local',
        10,
        7,
      )
      expect(db.query).toHaveBeenLastCalledWith(
        expect.stringContaining(`specification_id, ${endingKey}`),
        [
          2,
          10,
          '2026-09-16',
          now,
          context.actor.hsaId,
          'Owner',
          "Owner's closure reason",
        ],
      )
      expect(db.query.mock.calls.at(-1)?.[0]).not.toContain(input.reason.trim())
    },
  )

  it('rejects invalid item references before querying', async () => {
    const db = setup([])
    await expect(
      closeApprovedDeviation(
        db,
        2,
        context,
        { ...input, itemRef: 'invalid' },
        now,
      ),
    ).rejects.toMatchObject({ code: 'not_found' })
    expect(db.query).not.toHaveBeenCalled()
  })

  it('rejects approvals outside the selected requirement and specification', async () => {
    const db = setup([[]])
    await expect(
      closeApprovedDeviation(db, 2, context, input, now),
    ).rejects.toMatchObject({ code: 'not_found' })
    expect(assertDeviationMutationAllowed).not.toHaveBeenCalled()
    expect(db.query).toHaveBeenCalledTimes(1)
  })

  it('propagates the historical-content guard without recording an ending', async () => {
    const db = setup([[{ id: 10 }]])
    vi.mocked(assertDeviationMutationAllowed).mockRejectedValueOnce(
      conflictError('Historical content', { reason: 'binding_reserved' }),
    )
    await expect(
      closeApprovedDeviation(db, 2, context, input, now),
    ).rejects.toMatchObject({ details: { reason: 'binding_reserved' } })
    expect(db.query).toHaveBeenCalledTimes(1)
  })

  it('makes repeated closure idempotent', async () => {
    const db = setup([[{ id: 10 }], [{ id: 99 }]])
    await expect(
      closeApprovedDeviation(db, 2, context, input, now),
    ).resolves.toBeUndefined()
    expect(db.query).toHaveBeenCalledTimes(2)
  })

  it.each([
    { results: [[{ id: 10 }], [], []], reason: 'deviation_not_applicable' },
    {
      results: [[{ id: 10 }], [], [{ id: 10 }], [{ id: 11 }]],
      reason: 'deviation_renewal_pending',
    },
    {
      results: [[{ id: 10 }], [], [{ id: 10 }], [], [{ id: 11 }]],
      reason: 'deviation_superseded',
    },
    {
      results: [[{ id: 10 }], [], [{ id: 10 }], [], []],
      reason: 'deviation_superseded',
    },
  ])('rejects $reason without writing', async ({ results, reason }) => {
    const db = setup(results)
    await expect(
      closeApprovedDeviation(db, 2, context, input, now),
    ).rejects.toMatchObject({ code: 'conflict', details: { reason } })
    expect(db.query).toHaveBeenCalledTimes(results.length)
  })

  it('propagates persistence failures so the caller can roll back', async () => {
    const db = setup([[{ id: 10 }], [], [{ id: 10 }], [], [{ id: 10 }]])
    db.query.mockRejectedValueOnce(new Error('Insert failed'))
    await expect(
      closeApprovedDeviation(db, 2, context, input, now),
    ).rejects.toThrow('Insert failed')
  })
})
