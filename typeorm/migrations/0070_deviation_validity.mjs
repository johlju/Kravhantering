// Classify existing agreement-end evidence without inferring decision terms or actors.
const UP_STATEMENTS = [
  `IF COL_LENGTH('deviations', 'conditions') IS NULL
    ALTER TABLE [deviations] ADD [conditions] nvarchar(max) NULL;`,
  `IF COL_LENGTH('deviations', 'valid_through') IS NULL
    ALTER TABLE [deviations] ADD [valid_through] date NULL;`,
  `IF COL_LENGTH('deviations', 'renews_deviation_id') IS NULL
    ALTER TABLE [deviations] ADD [renews_deviation_id] int NULL;`,
  `IF OBJECT_ID('fk_deviations_renews_deviation_id', 'F') IS NULL
    ALTER TABLE [deviations] ADD CONSTRAINT [fk_deviations_renews_deviation_id] FOREIGN KEY ([renews_deviation_id]) REFERENCES [deviations] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('deviations') AND name = 'idx_deviations_renews_deviation_id')
    CREATE INDEX [idx_deviations_renews_deviation_id] ON [deviations] ([renews_deviation_id]);`,
  `IF COL_LENGTH('specification_local_requirement_deviations', 'conditions') IS NULL
    ALTER TABLE [specification_local_requirement_deviations] ADD [conditions] nvarchar(max) NULL;`,
  `IF COL_LENGTH('specification_local_requirement_deviations', 'valid_through') IS NULL
    ALTER TABLE [specification_local_requirement_deviations] ADD [valid_through] date NULL;`,
  `IF COL_LENGTH('specification_local_requirement_deviations', 'renews_deviation_id') IS NULL
    ALTER TABLE [specification_local_requirement_deviations] ADD [renews_deviation_id] int NULL;`,
  `IF OBJECT_ID('fk_specification_local_requirement_deviations_renews_deviation_id', 'F') IS NULL
    ALTER TABLE [specification_local_requirement_deviations] ADD CONSTRAINT [fk_specification_local_requirement_deviations_renews_deviation_id] FOREIGN KEY ([renews_deviation_id]) REFERENCES [specification_local_requirement_deviations] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('specification_local_requirement_deviations') AND name = 'idx_specification_local_requirement_deviations_renews_deviation_id')
    CREATE INDEX [idx_specification_local_requirement_deviations_renews_deviation_id] ON [specification_local_requirement_deviations] ([renews_deviation_id]);`,
  `IF COL_LENGTH('specification_deviation_endings', 'ending_kind') IS NULL
    ALTER TABLE [specification_deviation_endings] ADD [ending_kind] nvarchar(32) NULL;`,
  `IF COL_LENGTH('specification_deviation_endings', 'reason') IS NULL
    ALTER TABLE [specification_deviation_endings] ADD [reason] nvarchar(max) NULL;`,
  `IF COL_LENGTH('specification_deviation_endings', 'recorded_by_display_name') IS NULL
    ALTER TABLE [specification_deviation_endings] ADD [recorded_by_display_name] nvarchar(max) NULL;`,
  `UPDATE ending SET ending_kind = 'agreement_ended'
    FROM specification_deviation_endings ending
    INNER JOIN specification_agreements agreement ON agreement.id = ending.agreement_id
    WHERE ending.ending_kind IS NULL AND agreement.ended_at = ending.ended_at;`,
]

export class DeviationValidity1789516800000 {
  name = 'DeviationValidity1789516800000'

  async up(queryRunner) {
    for (const statement of UP_STATEMENTS) await queryRunner.query(statement)
  }

  async down() {
    throw new Error(
      'Deviation approval terms must be preserved. Restore a verified backup to roll back.',
    )
  }
}
