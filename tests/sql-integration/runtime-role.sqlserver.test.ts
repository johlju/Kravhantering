import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createArea,
  deleteArea,
  listAreas,
  updateArea,
} from '@/lib/dal/requirement-areas'
import { createAppDataSource } from '@/lib/typeorm/data-source'
import {
  resetSqlServerDatabase,
  runSqlServerMigrations,
  SQL_SERVER_RUNTIME_ROLE,
} from '@/scripts/db-sqlserver-admin.mjs'
import RuntimeRoleMigration from '@/typeorm/migrations/0054_runtime_role.mjs'
import { resolveSqlIntegrationTestsUrl } from './helpers/sql-test-database'

const RUNTIME_LOGIN = 'kravhantering_runtime_test'
const RUNTIME_PASSWORD = 'RoleOnly!Passw0rd842'
const MIGRATION_LOGIN = 'kravhantering_migration_test'
const MIGRATION_PASSWORD = 'SchemaOnly!Passw0rd517'

function connectionStringFor(
  baseConnectionString: string,
  username: string,
  password: string,
  database?: string,
): string {
  const url = new URL(baseConnectionString)
  url.username = username
  url.password = password
  if (database) url.pathname = `/${encodeURIComponent(database)}`
  return url.toString()
}

describe('least-privilege SQL Server runtime role', () => {
  const adminConnectionString = resolveSqlIntegrationTestsUrl()
  const parsedAdminConnectionString = new URL(adminConnectionString)
  const adminUsername = decodeURIComponent(parsedAdminConnectionString.username)
  const adminPassword = decodeURIComponent(parsedAdminConnectionString.password)
  const integrationDatabase = decodeURIComponent(
    parsedAdminConnectionString.pathname.replace(/^\//u, ''),
  )
  const migrationProbeDatabase = `${integrationDatabase}_migration_identity`
  const migrationProbeAdminUrl = connectionStringFor(
    adminConnectionString,
    adminUsername,
    adminPassword,
    migrationProbeDatabase,
  )
  const migrationProbeUrl = connectionStringFor(
    adminConnectionString,
    MIGRATION_LOGIN,
    MIGRATION_PASSWORD,
    migrationProbeDatabase,
  )
  const masterDb = createAppDataSource({
    url: connectionStringFor(
      adminConnectionString,
      adminUsername,
      adminPassword,
      'master',
    ),
  })
  const adminDb = createAppDataSource({ url: adminConnectionString })
  const runtimeDb = createAppDataSource({
    url: connectionStringFor(
      adminConnectionString,
      RUNTIME_LOGIN,
      RUNTIME_PASSWORD,
    ),
  })
  const migrationDb = createAppDataSource({
    url: connectionStringFor(
      adminConnectionString,
      MIGRATION_LOGIN,
      MIGRATION_PASSWORD,
    ),
  })

  beforeAll(async () => {
    await masterDb.initialize()
    await adminDb.initialize()
    await masterDb.query(`
      IF EXISTS (SELECT 1 FROM sys.sql_logins WHERE name = N'${RUNTIME_LOGIN}')
        ALTER LOGIN [${RUNTIME_LOGIN}] WITH PASSWORD = '${RUNTIME_PASSWORD}'
      ELSE
        CREATE LOGIN [${RUNTIME_LOGIN}] WITH PASSWORD = '${RUNTIME_PASSWORD}'

      IF EXISTS (SELECT 1 FROM sys.sql_logins WHERE name = N'${MIGRATION_LOGIN}')
        ALTER LOGIN [${MIGRATION_LOGIN}] WITH PASSWORD = '${MIGRATION_PASSWORD}'
      ELSE
        CREATE LOGIN [${MIGRATION_LOGIN}] WITH PASSWORD = '${MIGRATION_PASSWORD}'
    `)
    await adminDb.query(`
      IF DATABASE_PRINCIPAL_ID(N'${RUNTIME_LOGIN}') IS NULL
        CREATE USER [${RUNTIME_LOGIN}] FOR LOGIN [${RUNTIME_LOGIN}]
      IF DATABASE_PRINCIPAL_ID(N'${MIGRATION_LOGIN}') IS NULL
        CREATE USER [${MIGRATION_LOGIN}] FOR LOGIN [${MIGRATION_LOGIN}]

      IF NOT EXISTS (
        SELECT 1
        FROM sys.database_role_members AS members
        INNER JOIN sys.database_principals AS roles
          ON roles.principal_id = members.role_principal_id
        INNER JOIN sys.database_principals AS principals
          ON principals.principal_id = members.member_principal_id
        WHERE roles.name = N'${SQL_SERVER_RUNTIME_ROLE}'
          AND principals.name = N'${RUNTIME_LOGIN}'
      )
        ALTER ROLE [${SQL_SERVER_RUNTIME_ROLE}] ADD MEMBER [${RUNTIME_LOGIN}]

      IF NOT EXISTS (
        SELECT 1
        FROM sys.database_role_members AS members
        INNER JOIN sys.database_principals AS roles
          ON roles.principal_id = members.role_principal_id
        INNER JOIN sys.database_principals AS principals
          ON principals.principal_id = members.member_principal_id
        WHERE roles.name = N'db_owner'
          AND principals.name = N'${MIGRATION_LOGIN}'
      )
        ALTER ROLE [db_owner] ADD MEMBER [${MIGRATION_LOGIN}]
    `)
    await runtimeDb.initialize()
    await migrationDb.initialize()
  })

  afterAll(async () => {
    if (runtimeDb.isInitialized) await runtimeDb.destroy()
    if (migrationDb.isInitialized) await migrationDb.destroy()
    if (adminDb.isInitialized) {
      await adminDb.query(`
        IF OBJECT_ID(N'runtime_role_ddl_probe', N'U') IS NOT NULL
          DROP TABLE [runtime_role_ddl_probe]
        IF DATABASE_PRINCIPAL_ID(N'${RUNTIME_LOGIN}') IS NOT NULL
          DROP USER [${RUNTIME_LOGIN}]
        IF DATABASE_PRINCIPAL_ID(N'${MIGRATION_LOGIN}') IS NOT NULL
          DROP USER [${MIGRATION_LOGIN}]
      `)
      await adminDb.destroy()
    }
    if (masterDb.isInitialized) {
      await masterDb.query(`
        IF DB_ID(N'${migrationProbeDatabase}') IS NOT NULL
        BEGIN
          ALTER DATABASE [${migrationProbeDatabase}]
            SET SINGLE_USER WITH ROLLBACK IMMEDIATE
          DROP DATABASE [${migrationProbeDatabase}]
        END
        IF EXISTS (SELECT 1 FROM sys.sql_logins WHERE name = N'${RUNTIME_LOGIN}')
          DROP LOGIN [${RUNTIME_LOGIN}]
        IF EXISTS (SELECT 1 FROM sys.sql_logins WHERE name = N'${MIGRATION_LOGIN}')
          DROP LOGIN [${MIGRATION_LOGIN}]
      `)
      await masterDb.destroy()
    }
  })

  it('reconciles the custom role idempotently with only runtime DML grants', async () => {
    await adminDb.query(`
      GRANT ALTER ON SCHEMA::[dbo] TO [${SQL_SERVER_RUNTIME_ROLE}]
      ALTER ROLE [db_owner] ADD MEMBER [${SQL_SERVER_RUNTIME_ROLE}]
    `)
    const migration = new RuntimeRoleMigration()
    await expect(migration.up(migrationDb)).resolves.toBeUndefined()
    await expect(migration.up(migrationDb)).resolves.toBeUndefined()

    const unexpectedPermissions = (await adminDb.query(
      `SELECT permission_name AS permissionName
       FROM sys.database_permissions
       WHERE grantee_principal_id = DATABASE_PRINCIPAL_ID(@0)
         AND NOT (
           class_desc = N'OBJECT_OR_COLUMN'
           AND state_desc = N'GRANT'
           AND minor_id = 0
           AND permission_name IN (N'SELECT', N'INSERT', N'UPDATE', N'DELETE')
           AND (
             OBJECT_NAME(major_id) <> N'migrations'
             OR permission_name = N'SELECT'
           )
         )`,
      [SQL_SERVER_RUNTIME_ROLE],
    )) as Array<{ permissionName: string }>
    expect(unexpectedPermissions).toEqual([])

    const representativePermissions = (await adminDb.query(
      `SELECT
         OBJECT_NAME(major_id) AS objectName,
         permission_name AS permissionName
       FROM sys.database_permissions
       WHERE grantee_principal_id = DATABASE_PRINCIPAL_ID(@0)
         AND OBJECT_NAME(major_id) IN (N'migrations', N'requirement_areas')
       ORDER BY objectName, permissionName`,
      [SQL_SERVER_RUNTIME_ROLE],
    )) as Array<{ objectName: string; permissionName: string }>
    expect(representativePermissions).toEqual([
      { objectName: 'migrations', permissionName: 'SELECT' },
      { objectName: 'requirement_areas', permissionName: 'DELETE' },
      { objectName: 'requirement_areas', permissionName: 'INSERT' },
      { objectName: 'requirement_areas', permissionName: 'SELECT' },
      { objectName: 'requirement_areas', permissionName: 'UPDATE' },
    ])

    const parentRoles = (await adminDb.query(
      `SELECT roles.name
       FROM sys.database_role_members AS members
       INNER JOIN sys.database_principals AS roles
         ON roles.principal_id = members.role_principal_id
       WHERE members.member_principal_id = DATABASE_PRINCIPAL_ID(@0)`,
      [SQL_SERVER_RUNTIME_ROLE],
    )) as Array<{ name: string }>
    expect(parentRoles).toEqual([])
  })

  it('supports health and representative runtime data workflows using only the custom role', async () => {
    const memberships = (await adminDb.query(
      `SELECT roles.name
       FROM sys.database_role_members AS members
       INNER JOIN sys.database_principals AS roles
         ON roles.principal_id = members.role_principal_id
       INNER JOIN sys.database_principals AS principals
         ON principals.principal_id = members.member_principal_id
       WHERE principals.name = @0
       ORDER BY roles.name`,
      [RUNTIME_LOGIN],
    )) as Array<{ name: string }>
    expect(memberships.map(({ name }) => name)).toEqual([
      SQL_SERVER_RUNTIME_ROLE,
    ])

    await expect(runtimeDb.query('SELECT 1 AS ok')).resolves.toEqual([
      { ok: 1 },
    ])
    await expect(
      runtimeDb.query('SELECT TOP (1) [name] FROM [migrations]'),
    ).resolves.toHaveLength(1)

    const area = await createArea(runtimeDb, {
      description: 'Runtime role integration probe',
      name: 'Runtime role probe',
      ownerHsaId: 'SE5560000001-runtime',
      ownerPerson: {
        email: 'runtime.role@example.test',
        givenName: 'Runtime',
        hsaId: 'SE5560000001-runtime',
        middleName: null,
        surname: 'Role',
      },
      prefix: 'RTP',
    })
    expect((await listAreas(runtimeDb)).map(({ id }) => id)).toContain(area.id)
    await expect(
      updateArea(runtimeDb, area.id, { name: 'Updated runtime role probe' }),
    ).resolves.toMatchObject({
      id: area.id,
      name: 'Updated runtime role probe',
    })
    await expect(deleteArea(runtimeDb, area.id)).resolves.toBe(1)
  })

  it('allows the migration identity and denies the runtime identity schema access', async () => {
    const migrationMemberships = (await adminDb.query(
      `SELECT roles.name
       FROM sys.database_role_members AS members
       INNER JOIN sys.database_principals AS roles
         ON roles.principal_id = members.role_principal_id
       INNER JOIN sys.database_principals AS principals
         ON principals.principal_id = members.member_principal_id
       WHERE principals.name = @0`,
      [MIGRATION_LOGIN],
    )) as Array<{ name: string }>
    expect(migrationMemberships.map(({ name }) => name)).toEqual(['db_owner'])

    await resetSqlServerDatabase(migrationProbeAdminUrl)
    const migrationProbeAdminDb = createAppDataSource({
      url: migrationProbeAdminUrl,
    })
    await migrationProbeAdminDb.initialize()
    try {
      await migrationProbeAdminDb.query(`
        CREATE USER [${MIGRATION_LOGIN}] FOR LOGIN [${MIGRATION_LOGIN}]
        ALTER ROLE [db_owner] ADD MEMBER [${MIGRATION_LOGIN}]
      `)
    } finally {
      await migrationProbeAdminDb.destroy()
    }

    const migrationResult = await runSqlServerMigrations(migrationProbeUrl)
    expect(migrationResult.migrationsApplied).toBeGreaterThan(50)
    expect(migrationResult.postMigration.observedHead?.name).toBe(
      'RuntimeRole1720100000000',
    )

    await expect(
      migrationDb.query(
        'CREATE TABLE [runtime_role_ddl_probe] ([id] int NOT NULL)',
      ),
    ).resolves.toBeUndefined()
    await expect(
      migrationDb.query('DROP TABLE [runtime_role_ddl_probe]'),
    ).resolves.toBeUndefined()
    await expect(
      runtimeDb.query(
        'CREATE TABLE [runtime_role_ddl_probe] ([id] int NOT NULL)',
      ),
    ).rejects.toThrow(/permission|denied/u)
    await expect(
      runtimeDb.query('UPDATE [migrations] SET [name] = [name] WHERE 1 = 0'),
    ).rejects.toThrow(/permission|denied/u)
  })
})
