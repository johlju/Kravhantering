import { describe, expect, it } from 'vitest'
import { VERIFIED_SPECIFICATION_ITEM_STATUS_ID } from '@/lib/specification-item-status-constants'
import {
  type ApprovalCase,
  type ApprovalEnding,
  deviationApplicability,
  deviationNeedsFollowup,
} from '@/lib/specifications/deviation-applicability'

const at = new Date('2026-09-15T12:00:00Z')
const approval: ApprovalCase = {
  id: 10,
  itemRef: 'lib:3',
  decision: 1,
  decidedAt: '2026-09-01T10:00:00Z',
}

function state(
  changes: Partial<ApprovalCase> = {},
  cases: ApprovalCase[] = [],
  endings: ApprovalEnding[] = [],
  cutoff = at,
) {
  return deviationApplicability(
    { ...approval, ...changes },
    cases,
    endings,
    cutoff,
  )
}

describe('deviation applicability at the selected cutoff', () => {
  it.each([
    [null, 'pending'],
    [2, 'rejected'],
    [3, 'cancelled'],
    [1, 'applicable'],
  ] as const)('maps recorded decision %s to %s', (decision, expected) => {
    expect(state({ decision })).toBe(expected)
  })

  it('keeps a future decision pending and supports undated approvals', () => {
    expect(state({ decidedAt: '2026-09-16' })).toBe('pending')
    expect(state({ decidedAt: null })).toBe('applicable')
  })

  it('includes the entire Stockholm end date across the daylight saving boundary', () => {
    expect(
      state(
        { validThrough: '2026-10-25' },
        [],
        [],
        new Date('2026-10-25T22:59:59Z'),
      ),
    ).toBe('applicable')
    expect(
      state(
        { validThrough: '2026-10-25' },
        [],
        [],
        new Date('2026-10-25T23:00:00Z'),
      ),
    ).toBe('expired')
  })

  it.each([
    [{ id: 11 }, 'superseded'],
    [{ id: 9 }, 'applicable'],
    [{ id: 9, decidedAt: '2026-09-02' }, 'superseded'],
    [{ id: 11, decidedAt: '2026-08-31' }, 'applicable'],
    [{ id: 11, decidedAt: '2026-09-16' }, 'applicable'],
    [{ id: 11, itemRef: 'local:3' }, 'applicable'],
    [{ id: 11, decision: 2 }, 'applicable'],
    [{ id: 11, decidedAt: null }, 'applicable'],
  ] as const)(
    'compares replacement %j at the cutoff',
    (candidate, expected) => {
      expect(state({}, [{ ...approval, ...candidate }])).toBe(expected)
    },
  )

  it('breaks ties between undated approvals by id', () => {
    expect(
      state({ decidedAt: null }, [{ ...approval, decidedAt: null, id: 11 }]),
    ).toBe('superseded')
  })

  it.each([
    ['closed', 'closed'],
    ['superseded', 'superseded'],
    ['agreement_ended', 'agreement_ended'],
    [undefined, 'content_replaced'],
  ] as const)('preserves ending kind %s', (endingKind, expected) => {
    expect(
      state(
        {},
        [],
        [{ deviationId: 10, itemRef: 'lib:3', endedAt: at, endingKind }],
      ),
    ).toBe(expected)
  })

  it('uses the earliest recorded matching ending and ignores unrelated or future endings', () => {
    const ending = {
      deviationId: 10,
      itemRef: 'lib:3',
      endedAt: '2026-09-10',
      endingKind: 'closed',
    }
    expect(
      state(
        {},
        [],
        [
          { ...ending, endedAt: '2026-09-11', endingKind: 'agreement_ended' },
          { ...ending, deviationId: 9, endedAt: '2026-09-02' },
          { ...ending, itemRef: 'local:3', endedAt: '2026-09-02' },
          { ...ending, endedAt: null },
          { ...ending, endedAt: '2026-09-16' },
          ending,
        ],
      ),
    ).toBe('closed')
  })

  it('reports expiry when permission expired before the recorded ending', () => {
    const ending = {
      deviationId: 10,
      itemRef: 'lib:3',
      endedAt: '2026-09-10',
      endingKind: 'closed',
    }
    expect(state({ validThrough: '2026-09-09' }, [], [ending])).toBe('expired')
    expect(state({ validThrough: '2026-09-10' }, [], [ending])).toBe('closed')
  })
})

describe('deviation follow-up', () => {
  it.each([
    'expired',
    'closed',
    'superseded',
    'content_replaced',
    'agreement_ended',
  ] as const)(
    'requires follow-up for current unverified %s permission',
    status => {
      expect(deviationNeedsFollowup([status], null, true)).toBe(true)
      expect(
        deviationNeedsFollowup(
          [status],
          VERIFIED_SPECIFICATION_ITEM_STATUS_ID,
          true,
        ),
      ).toBe(false)
      expect(deviationNeedsFollowup([status], null, false)).toBe(false)
      expect(deviationNeedsFollowup([status, 'applicable'], null, true)).toBe(
        false,
      )
    },
  )

  it('does not request follow-up when no permission has ended', () => {
    expect(deviationNeedsFollowup([], null, true)).toBe(false)
    expect(
      deviationNeedsFollowup(['pending', 'rejected', 'cancelled'], null, true),
    ).toBe(false)
  })
})
