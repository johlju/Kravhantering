import { EntitySchema } from 'typeorm'

export interface ExportActorQuotaEntryEntity {
  actorFingerprint: string
  createdAt: Date
  expiresAt: Date
  id: string
  releasedAt: Date | null
}

export const exportActorQuotaEntryEntity =
  new EntitySchema<ExportActorQuotaEntryEntity>({
    name: 'ExportActorQuotaEntry',
    tableName: 'export_actor_quota_entries',
    columns: {
      id: { name: 'id', type: 'uniqueidentifier', primary: true },
      actorFingerprint: {
        name: 'actor_fingerprint',
        type: 'nvarchar',
        length: 26,
      },
      createdAt: { name: 'created_at', type: 'datetime2', precision: 3 },
      releasedAt: {
        name: 'released_at',
        type: 'datetime2',
        precision: 3,
        nullable: true,
      },
      expiresAt: { name: 'expires_at', type: 'datetime2', precision: 3 },
    },
    indices: [
      {
        name: 'idx_export_actor_quota_entries_actor_fingerprint_created_at',
        columns: ['actorFingerprint', 'createdAt'],
      },
      {
        name: 'idx_export_actor_quota_entries_expires_at',
        columns: ['expiresAt'],
      },
    ],
    checks: [
      {
        name: 'chk_export_actor_quota_entries_actor_fingerprint',
        expression:
          "LEN([actor_fingerprint]) = 26 AND [actor_fingerprint] LIKE N'hfp[_]%'",
      },
      {
        name: 'chk_export_actor_quota_entries_time_order',
        expression:
          '[expires_at] > [created_at] AND ([released_at] IS NULL OR [released_at] >= [created_at])',
      },
    ],
  })
