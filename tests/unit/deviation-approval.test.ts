import { describe, expect, it, vi } from 'vitest'
import {
  assertRenewalTarget,
  preserveApprovalReplacement,
} from '@/lib/specifications/deviation-approval'

describe.each(['library', 'local'] as const)('%s deviation approval', kind => {
  it.each([
    { latest: [], target: undefined },
    { latest: [{ id: 10, isClosed: 1 }], target: undefined },
    { latest: [{ id: 10, isClosed: 0 }], target: 10 },
  ])(
    'accepts a fresh request or renewal of the latest open approval: %j',
    async ({ latest, target }) => {
      const db = { query: vi.fn().mockResolvedValue(latest) }
      await expect(
        assertRenewalTarget(db, kind, 3, target),
      ).resolves.toBeUndefined()
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining(
          kind === 'library'
            ? 'approval.specification_item_id = @0'
            : 'approval.specification_local_requirement_id = @0',
        ),
        [3],
      )
    },
  )

  it.each([
    { latest: [], target: 10, reason: 'deviation_renewal_target' },
    {
      latest: [{ id: 10, isClosed: 0 }],
      target: undefined,
      reason: 'deviation_renewal_target',
    },
    {
      latest: [{ id: 10, isClosed: 0 }],
      target: 9,
      reason: 'deviation_renewal_target',
    },
    {
      latest: [{ id: 10, isClosed: 1 }],
      target: 10,
      reason: 'deviation_approval_closed',
    },
  ])(
    'rejects an invalid renewal with $reason',
    async ({ latest, target, reason }) => {
      const db = { query: vi.fn().mockResolvedValue(latest) }
      await expect(
        assertRenewalTarget(db, kind, 3, target),
      ).rejects.toMatchObject({ code: 'conflict', details: { reason } })
    },
  )

  it('inherits pending ending plans before superseding earlier approvals', async () => {
    const db = { query: vi.fn().mockResolvedValue([]) }
    const now = new Date('2026-09-15T22:30:00Z')
    await preserveApprovalReplacement(db, kind, 11, 'reviewer', now)
    expect(db.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(
        'ending.cancelled_at IS NULL AND ending.ended_at IS NULL',
      ),
      [11, now, 'reviewer'],
    )
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("'superseded'"),
      [11, '2026-09-16', now, 'reviewer'],
    )
    expect(db.query.mock.calls[1][0]).toContain(
      kind === 'library'
        ? 'ending.deviation_id = previous.id'
        : 'ending.local_deviation_id = previous.id',
    )
  })

  it('propagates ending-plan failure before superseding approvals', async () => {
    const db = { query: vi.fn().mockRejectedValue(new Error('Plan failed')) }
    await expect(
      preserveApprovalReplacement(db, kind, 11, 'reviewer', new Date()),
    ).rejects.toThrow('Plan failed')
    expect(db.query).toHaveBeenCalledTimes(1)
  })
})
