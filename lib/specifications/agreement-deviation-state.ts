import { deviationTables } from '@/lib/specifications/deviation-approval'

function newerApprovalSql(kind: 'library' | 'local', cutoff: string): string {
  const { cases, binding } = deviationTables(kind)
  return `EXISTS (SELECT 1 FROM ${cases} successor WHERE successor.${binding} = deviation.${binding}
    AND successor.decision = 1 AND (successor.decided_at IS NULL OR successor.decided_at <= ${cutoff})
    AND (COALESCE(successor.decided_at, '0001-01-01') > COALESCE(deviation.decided_at, '0001-01-01')
      OR (COALESCE(successor.decided_at, '0001-01-01') = COALESCE(deviation.decided_at, '0001-01-01') AND successor.id > deviation.id)))`
}

/** Fixed SQL aliases only. SQL Server's clock enforces expiry even without a prior read. */
export function applicableDeviationSql(
  kind: 'library' | 'local',
  cutoff = 'SYSUTCDATETIME()',
): string {
  const { endingCase: caseColumn } = deviationTables(kind)
  return `(deviation.decision = 1 AND (deviation.decided_at IS NULL OR deviation.decided_at <= ${cutoff})
    AND (deviation.valid_through IS NULL OR deviation.valid_through >= CONVERT(date, (${cutoff} AT TIME ZONE 'UTC') AT TIME ZONE 'Central European Standard Time'))
    AND NOT ${newerApprovalSql(kind, cutoff)}
    AND NOT EXISTS (SELECT 1 FROM specification_deviation_endings ending WHERE ending.${caseColumn} = deviation.id
      AND ending.ended_at <= ${cutoff}))`
}

/** Recorded outcomes and present permission are separate counts. */
export function agreementDeviationStateSql(kind: 'library' | 'local') {
  const item = kind === 'library' ? 'specification_item' : 'local_requirement'
  const cutoff = `${item}.followup_frozen_at`
  const decisionRecorded = `(${cutoff} IS NULL OR deviation.decided_at <= ${cutoff})`
  return {
    visible: `(${cutoff} IS NULL OR deviation.created_at <= ${cutoff})`,
    pending: `(deviation.decision IS NULL OR deviation.decided_at > ${cutoff})`,
    approved: `(deviation.decision = 1 AND ${decisionRecorded})`,
    applicable: applicableDeviationSql(
      kind,
      `COALESCE(${cutoff}, SYSUTCDATETIME())`,
    ),
    rejected: `(deviation.decision = 2 AND ${decisionRecorded})`,
  }
}

/** Current-case reads outside a selected agreement still expose permission separately. */
export function currentDeviationApplicabilitySql(
  kind: 'library' | 'local',
): string {
  const { endingCase: caseColumn } = deviationTables(kind)
  return `CASE WHEN deviation.decision IS NULL OR deviation.decided_at > SYSUTCDATETIME() THEN 'pending'
    WHEN deviation.decision = 2 THEN 'rejected' WHEN deviation.decision = 3 THEN 'cancelled'
    WHEN ${newerApprovalSql(kind, 'SYSUTCDATETIME()')} THEN 'superseded'
    WHEN ${applicableDeviationSql(kind)} THEN 'applicable'
    ELSE COALESCE((SELECT TOP (1) COALESCE(ending.ending_kind, 'content_replaced')
      FROM specification_deviation_endings ending WHERE ending.${caseColumn} = deviation.id
        AND ending.ended_at <= SYSUTCDATETIME() AND (deviation.valid_through IS NULL OR
          CONVERT(date, (ending.ended_at AT TIME ZONE 'UTC') AT TIME ZONE 'Central European Standard Time') <= deviation.valid_through)
      ORDER BY ending.ended_at, ending.id),
      CASE WHEN deviation.valid_through < CONVERT(date, (SYSUTCDATETIME() AT TIME ZONE 'UTC') AT TIME ZONE 'Central European Standard Time')
        THEN 'expired' ELSE 'superseded' END) END`
}
