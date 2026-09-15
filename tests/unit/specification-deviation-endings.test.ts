import { describe, expect, it, vi } from 'vitest'
import type { RequestContext } from '@/lib/requirements/auth'
import { prepareAgreementConfirmation } from '@/lib/specifications/agreement-confirmation'
import {
  cancelPlannedDeviationEndings,
  guardAgreementRequirementChange,
} from '@/lib/specifications/agreement-deviation-endings'
import { endCurrentAgreement } from '@/lib/specifications/agreement-end'

const context = {
  actor: { hsaId: 'SE5560000001-owner', displayName: 'Owner' },
} as RequestContext
const now = new Date('2026-09-15T22:30:00Z')
function database(...results: unknown[][]) {
  const query = vi.fn()
  for (const rows of results) query.mockResolvedValueOnce(rows)
  return { query: query.mockResolvedValue([]) }
}
const approval = {
  agreementItemId: 4,
  agreementReference: 'B',
  decision: 1,
  deviationId: 10,
  effectiveDate: '2026-10-01',
  itemRef: 'lib:3',
  motivation: 'Temporary exception',
}

describe('deviation endings when confirming replacement content', () => {
  it('allows confirmation when no permission endings are required', async () => {
    const db = database([])
    await expect(
      prepareAgreementConfirmation(db, 2, 7, context, undefined, now),
    ).resolves.toBeUndefined()
    expect(db.query).toHaveBeenCalledOnce()
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UNION ALL'),
      [2, 7],
    )
  })

  it.each([
    { decision: null, authorized: true, reason: 'active_deviations' },
    { decision: 1, authorized: false, reason: 'approved_deviations' },
  ])(
    'blocks confirmation for $reason without writing',
    async ({ decision, authorized, reason }) => {
      const db = database([{ ...approval, decision }])
      await expect(
        prepareAgreementConfirmation(db, 2, 7, context, authorized, now),
      ).rejects.toMatchObject({ code: 'conflict', details: { reason } })
      expect(db.query).toHaveBeenCalledOnce()
    },
  )

  it('records authorized library and local endings for the future effective date', async () => {
    const db = database([
      approval,
      { ...approval, itemRef: 'local:3', deviationId: 11 },
    ])
    await prepareAgreementConfirmation(db, 2, 7, context, true, now)
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO specification_deviation_endings'),
      [2, 7, 'B', 4, 10, null, '2026-10-01', now, context.actor.hsaId],
    )
    expect(db.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO specification_deviation_endings'),
      [2, 7, 'B', 4, null, 11, '2026-10-01', now, context.actor.hsaId],
    )
  })
})

describe('deviation safeguards for requirement content changes', () => {
  const input = {
    itemRef: 'lib:3',
    agreementId: 7,
    authorizeDeviationEndings: true,
  }

  it('rejects malformed references before reading cases', async () => {
    const db = database()
    await expect(
      guardAgreementRequirementChange(
        db,
        2,
        context,
        { ...input, itemRef: 'invalid' },
        now,
      ),
    ).rejects.toMatchObject({ code: 'not_found' })
    expect(db.query).not.toHaveBeenCalled()
  })

  it('allows content changes when there are no pending or applicable deviations', async () => {
    const db = database([])
    await expect(
      guardAgreementRequirementChange(db, 2, context, input, now),
    ).resolves.toBeUndefined()
    expect(db.query).toHaveBeenCalledOnce()
  })

  it.each([
    { decision: null, authorized: true, reason: 'active_deviations' },
    { decision: 1, authorized: false, reason: 'approved_deviations' },
  ])(
    'requires resolution of $reason before changing content',
    async ({ decision, authorized, reason }) => {
      const db = database([{ id: 10, decision }])
      await expect(
        guardAgreementRequirementChange(
          db,
          2,
          context,
          { ...input, authorizeDeviationEndings: authorized },
          now,
        ),
      ).rejects.toMatchObject({ code: 'conflict', details: { reason } })
      expect(db.query).toHaveBeenCalledOnce()
    },
  )

  it.each([
    { owners: [] },
    { owners: [{ responsibleHsaId: 'SE5560000001-other' }] },
  ])(
    'requires the assigned responsible person to authorize endings (%#)',
    async ({ owners }) => {
      const db = database([{ id: 10, decision: 1 }], owners)
      await expect(
        guardAgreementRequirementChange(db, 2, context, input, now),
      ).rejects.toMatchObject({ code: 'forbidden' })
      expect(db.query).toHaveBeenCalledTimes(2)
    },
  )

  it('rejects a missing editable draft membership without recording an ending', async () => {
    const db = database(
      [{ id: 10, decision: 1 }],
      [{ responsibleHsaId: context.actor.hsaId }],
      [],
    )
    await expect(
      guardAgreementRequirementChange(db, 2, context, input, now),
    ).rejects.toMatchObject({ code: 'conflict' })
    expect(db.query).toHaveBeenCalledTimes(3)
  })

  it.each(['lib:3', 'local:3'])(
    'defers endings of inherited %s content to draft activation',
    async itemRef => {
      const db = database(
        [{ id: 10, decision: 1 }],
        [{ responsibleHsaId: context.actor.hsaId }],
        [
          {
            id: 4,
            reference: 'B',
            effectiveDate: '2026-10-01',
            isInherited: true,
          },
        ],
      )
      await guardAgreementRequirementChange(
        db,
        2,
        context,
        { ...input, itemRef },
        now,
      )
      expect(db.query).toHaveBeenLastCalledWith(
        expect.stringContaining(
          itemRef.startsWith('lib:') ? 'deviation_id' : 'local_deviation_id',
        ),
        [2, 7, 'B', 4, 10, '2026-10-01', now, context.actor.hsaId, null],
      )
    },
  )

  it.each([undefined, 7])(
    'ends permission immediately for content without an inherited current binding (agreement %s)',
    async agreementId => {
      const db = database(
        [{ id: 10, decision: 1 }],
        [{ responsibleHsaId: context.actor.hsaId }],
        ...(agreementId === undefined
          ? []
          : [
              [
                {
                  id: 4,
                  reference: 'B',
                  effectiveDate: '2026-10-01',
                  isInherited: false,
                },
              ],
            ]),
      )
      await guardAgreementRequirementChange(
        db,
        2,
        context,
        { ...input, agreementId },
        now,
      )
      expect(db.query.mock.calls.at(-1)?.[1]).toEqual([
        2,
        agreementId ?? null,
        agreementId ? 'B' : null,
        agreementId ? 4 : null,
        10,
        agreementId ? '2026-10-01' : '2026-09-16',
        now,
        context.actor.hsaId,
        now,
      ])
    },
  )

  it.each([undefined, 4])(
    'cancels only outstanding plans in the requested scope (%s)',
    async membershipId => {
      const db = database()
      await cancelPlannedDeviationEndings(
        db,
        7,
        context.actor.hsaId,
        now,
        membershipId,
      )
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('cancelled_at IS NULL AND ended_at IS NULL'),
        membershipId === undefined
          ? [7, now, context.actor.hsaId]
          : [7, now, context.actor.hsaId, 4],
      )
      if (membershipId !== undefined)
        expect(db.query.mock.calls[0][0]).toContain(
          'AND agreement_item_id = @3',
        )
    },
  )
})

describe('ending an agreement and its shared permissions', () => {
  const input = {
    agreementId: 7,
    endDate: '2026-09-16',
    reason: 'Service retired',
  }
  const agreement = { reference: 'A', effectiveDate: '2026-01-01' }

  it('requires the pending agreement to be resolved first', async () => {
    const db = database([{ id: 8 }])
    await expect(
      endCurrentAgreement(db, 2, context, input, now),
    ).rejects.toMatchObject({
      details: { reason: 'pending_agreement', agreementId: 8 },
    })
    expect(db.query).toHaveBeenCalledOnce()
  })

  it('requires a current agreement', async () => {
    const db = database([], [])
    await expect(
      endCurrentAgreement(db, 2, context, input, now),
    ).rejects.toMatchObject({ code: 'conflict' })
    expect(db.query).toHaveBeenCalledTimes(2)
  })

  it.each(['2025-12-31', '2026-09-17'])(
    'rejects end date %s outside the effective-date to Stockholm-today interval',
    async endDate => {
      const db = database([], [agreement])
      await expect(
        endCurrentAgreement(db, 2, context, { ...input, endDate }, now),
      ).rejects.toMatchObject({
        code: 'validation',
        details: { reason: 'agreement_end_date_invalid' },
      })
      expect(db.query).toHaveBeenCalledTimes(2)
    },
  )

  it('preserves follow-up snapshots and records both kinds of permission endings before ending the agreement', async () => {
    const db = database([], [agreement])
    await endCurrentAgreement(db, 2, context, input, now)
    expect(db.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('has_followup_snapshot = 1'),
      [7],
    )
    const endings = db.query.mock.calls.filter(([sql]) =>
      sql.includes('INSERT INTO specification_deviation_endings'),
    )
    expect(endings).toHaveLength(2)
    for (const [sql, values] of endings) {
      expect(sql).toContain("'agreement_ended'")
      expect(values).toEqual([
        2,
        7,
        'A',
        '2026-09-16',
        now,
        context.actor.hsaId,
      ])
    }
    expect(endings[0][0]).toContain('deviation_id')
    expect(endings[1][0]).toContain('local_deviation_id')
    expect(db.query).toHaveBeenLastCalledWith(
      expect.stringContaining(
        'UPDATE specification_agreements SET is_current = 0',
      ),
      [7, now, context.actor.hsaId, '2026-09-16', 'Service retired', 'Owner'],
    )
  })

  it('propagates a snapshot failure before changing permission or agreement state', async () => {
    const db = database([], [agreement])
    db.query.mockRejectedValueOnce(new Error('Snapshot failed'))
    await expect(
      endCurrentAgreement(db, 2, context, input, now),
    ).rejects.toThrow('Snapshot failed')
    expect(db.query).toHaveBeenCalledTimes(3)
  })
})
