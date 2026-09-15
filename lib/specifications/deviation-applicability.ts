import { VERIFIED_SPECIFICATION_ITEM_STATUS_ID } from '@/lib/specification-item-status-constants'
import { stockholmDate } from '@/lib/specifications/agreement-dates'

export type DeviationApplicability =
  | 'pending'
  | 'rejected'
  | 'cancelled'
  | 'applicable'
  | 'expired'
  | 'superseded'
  | 'closed'
  | 'content_replaced'
  | 'agreement_ended'

export interface ApprovalCase {
  decidedAt: Date | string | null
  decision: number | null
  id: number
  itemRef: string
  validThrough?: string | null
}

export interface ApprovalEnding {
  deviationId: number
  endedAt: Date | string | null
  endingKind?: string | null
  itemRef: string
}

/** Evaluate preserved decisions at one context cutoff, without mutating history. */
export function deviationApplicability(
  deviation: ApprovalCase,
  cases: readonly ApprovalCase[],
  endings: readonly ApprovalEnding[],
  at: Date,
): DeviationApplicability {
  const recorded = (value: ApprovalCase): boolean =>
    value.decidedAt == null || new Date(value.decidedAt) <= at
  if (!recorded(deviation) || deviation.decision === null) return 'pending'
  if (deviation.decision === 2) return 'rejected'
  if (deviation.decision === 3) return 'cancelled'
  const newer = cases.some(
    candidate =>
      candidate.itemRef === deviation.itemRef &&
      candidate.decision === 1 &&
      recorded(candidate) &&
      (new Date(candidate.decidedAt ?? 0).getTime() >
        new Date(deviation.decidedAt ?? 0).getTime() ||
        (new Date(candidate.decidedAt ?? 0).getTime() ===
          new Date(deviation.decidedAt ?? 0).getTime() &&
          candidate.id > deviation.id)),
  )
  if (newer) return 'superseded'
  const ending = endings
    .filter(
      value =>
        value.itemRef === deviation.itemRef &&
        value.deviationId === deviation.id &&
        value.endedAt &&
        new Date(value.endedAt) <= at,
    )
    .sort(
      (a, b) =>
        new Date(a.endedAt ?? 0).getTime() - new Date(b.endedAt ?? 0).getTime(),
    )[0]
  if (ending) {
    if (
      deviation.validThrough &&
      stockholmDate(new Date(ending.endedAt as Date | string)) >
        deviation.validThrough
    )
      return 'expired'
    if (
      ending.endingKind === 'closed' ||
      ending.endingKind === 'superseded' ||
      ending.endingKind === 'agreement_ended'
    )
      return ending.endingKind
    return 'content_replaced'
  }
  return deviation.validThrough && stockholmDate(at) > deviation.validThrough
    ? 'expired'
    : 'applicable'
}

export function deviationNeedsFollowup(
  states: readonly DeviationApplicability[],
  usageStatusId: number | null,
  current: boolean,
): boolean {
  return (
    current &&
    usageStatusId !== VERIFIED_SPECIFICATION_ITEM_STATUS_ID &&
    !states.includes('applicable') &&
    states.some(state =>
      [
        'expired',
        'closed',
        'superseded',
        'content_replaced',
        'agreement_ended',
      ].includes(state),
    )
  )
}
