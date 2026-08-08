const RUNTIME_ROLE = 'kravhantering_runtime'

const UP_STATEMENTS = [
  `IF DATABASE_PRINCIPAL_ID(N'${RUNTIME_ROLE}') IS NULL
    BEGIN
      CREATE ROLE [${RUNTIME_ROLE}] AUTHORIZATION [dbo]
    END

    GRANT SELECT, INSERT, UPDATE, DELETE
      ON SCHEMA::[dbo]
      TO [${RUNTIME_ROLE}]`,
]

const DOWN_STATEMENTS = [
  `IF DATABASE_PRINCIPAL_ID(N'${RUNTIME_ROLE}') IS NOT NULL
    BEGIN
      DROP ROLE [${RUNTIME_ROLE}]
    END`,
]

async function runStatements(queryRunner, statements) {
  for (const statement of statements) {
    await queryRunner.query(statement)
  }
}

export class RuntimeRole1720100000000 {
  name = 'RuntimeRole1720100000000'

  async up(queryRunner) {
    await runStatements(queryRunner, UP_STATEMENTS)
  }

  async down(queryRunner) {
    await runStatements(queryRunner, DOWN_STATEMENTS)
  }
}

export default RuntimeRole1720100000000
