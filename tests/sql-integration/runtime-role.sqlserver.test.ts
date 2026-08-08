import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createArea,
  deleteArea,
  listAreas,
  updateArea,
} from '@/lib/dal/requirement-areas'
import { createAppDataSource } from '@/lib/typeorm/data-source'
import { SQL_SERVER_RUNTIME_ROLE } from '@/scripts/db-sqlserver-admin.mjs'
import RuntimeRoleMigration from '@/typeorm/migrations/0054_runtime_role.mjs'
import { resolveSqlIntegrationTestsUrl } from './helpers/sql-test-database'

const RUNTIME_LOGIN = 'kravhantering_runtime_test'
const RUNTIME_PASSWORD = 'RoleOnly!Passw0rd842'

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

  beforeAll(async () => {
    await masterDb.initialize()
    await adminDb.initialize()
    await masterDb.query(`
      IF EXISTS (SELECT 1 FROM sys.sql_logins WHERE name = N'${RUNTIME_LOGIN}')
        ALTER LOGIN [${RUNTIME_LOGIN}] WITH PASSWORD = '${RUNTIME_PASSWORD}'
      ELSE
        CREATE LOGIN [${RUNTIME_LOGIN}] WITH PASSWORD = '${RUNTIME_PASSWORD}'
    `)
    await adminDb.query(`
      IF DATABASE_PRINCIPAL_ID(N'${RUNTIME_LOGIN}') IS NULL
        CREATE USER [${RUNTIME_LOGIN}] FOR LOGIN [${RUNTIME_LOGIN}]

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
    `)
    await runtimeDb.initialize()
  })

  afterAll(async () => {
    if (runtimeDb.isInitialized) await runtimeDb.destroy()
    if (adminDb.isInitialized) {
      await adminDb.query(`
        IF OBJECT_ID(N'runtime_role_ddl_probe', N'U') IS NOT NULL
          DROP TABLE [runtime_role_ddl_probe]
        IF DATABASE_PRINCIPAL_ID(N'${RUNTIME_LOGIN}') IS NOT NULL
          DROP USER [${RUNTIME_LOGIN}]
      `)
      await adminDb.destroy()
    }
    if (masterDb.isInitialized) {
      await masterDb.query(`
        IF EXISTS (SELECT 1 FROM sys.sql_logins WHERE name = N'${RUNTIME_LOGIN}')
          DROP LOGIN [${RUNTIME_LOGIN}]
      `)
      await masterDb.destroy()
    }
  })

  it('reconciles the custom role idempotently with only runtime DML grants', async () => {
    const migration = new RuntimeRoleMigration()
    await expect(migration.up(adminDb)).resolves.toBeUndefined()
    await expect(migration.up(adminDb)).resolves.toBeUndefined()

    const permissions = (await adminDb.query(
      `SELECT permission_name AS permissionName, state_desc AS stateDescription
       FROM sys.database_permissions
       WHERE grantee_principal_id = DATABASE_PRINCIPAL_ID(@0)
         AND class_desc = N'SCHEMA'
         AND major_id = SCHEMA_ID(N'dbo')
       ORDER BY permission_name`,
      [SQL_SERVER_RUNTIME_ROLE],
    )) as Array<{ permissionName: string; stateDescription: string }>
    expect(permissions).toEqual([
      { permissionName: 'DELETE', stateDescription: 'GRANT' },
      { permissionName: 'INSERT', stateDescription: 'GRANT' },
      { permissionName: 'SELECT', stateDescription: 'GRANT' },
      { permissionName: 'UPDATE', stateDescription: 'GRANT' },
    ])
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

  it('denies schema migration operations to the runtime identity', async () => {
    await expect(
      runtimeDb.query(
        'CREATE TABLE [runtime_role_ddl_probe] ([id] int NOT NULL)',
      ),
    ).rejects.toThrow(/permission|denied/u)
  })
})
