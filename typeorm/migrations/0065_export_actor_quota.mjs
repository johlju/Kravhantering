const UP_STATEMENTS = [
  `ALTER TABLE [application_settings] ADD
    [export_actor_starts_per_minute] int NOT NULL CONSTRAINT [df_application_settings_export_actor_starts_per_minute] DEFAULT 10,
    [export_actor_concurrency] int NOT NULL CONSTRAINT [df_application_settings_export_actor_concurrency] DEFAULT 1;`,
  `ALTER TABLE [application_settings] ADD
    CONSTRAINT [chk_application_settings_export_actor_starts_per_minute] CHECK ([export_actor_starts_per_minute] BETWEEN 1 AND 100),
    CONSTRAINT [chk_application_settings_export_actor_concurrency] CHECK ([export_actor_concurrency] BETWEEN 1 AND 10);`,
  `CREATE TABLE [export_actor_quota_entries] (
    [id] uniqueidentifier NOT NULL,
    [actor_fingerprint] nvarchar(26) NOT NULL,
    [created_at] datetime2(3) NOT NULL,
    [released_at] datetime2(3) NULL,
    [expires_at] datetime2(3) NOT NULL,
    CONSTRAINT [pk_export_actor_quota_entries] PRIMARY KEY ([id]),
    CONSTRAINT [chk_export_actor_quota_entries_actor_fingerprint] CHECK (LEN([actor_fingerprint]) = 26 AND [actor_fingerprint] LIKE N'hfp[_]%'),
    CONSTRAINT [chk_export_actor_quota_entries_time_order] CHECK ([expires_at] > [created_at] AND ([released_at] IS NULL OR [released_at] >= [created_at]))
  );`,
  `CREATE INDEX [idx_export_actor_quota_entries_actor_fingerprint_created_at] ON [export_actor_quota_entries] ([actor_fingerprint], [created_at]);`,
  `CREATE INDEX [idx_export_actor_quota_entries_expires_at] ON [export_actor_quota_entries] ([expires_at]);`,
]

export class ExportActorQuota1788825600000 {
  name = 'ExportActorQuota1788825600000'
  async up(queryRunner) {
    for (const statement of UP_STATEMENTS) await queryRunner.query(statement)
  }
  async down() {
    throw new Error(
      'Export actor quota rollback requires a coordinated application rollback; do not remove enforcement from running nodes.',
    )
  }
}
