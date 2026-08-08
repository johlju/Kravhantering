const RUNTIME_ROLE = 'kravhantering_runtime'

const UP_STATEMENTS = [
  `IF EXISTS (
      SELECT 1
      FROM sys.database_principals
      WHERE [name] = N'${RUNTIME_ROLE}'
        AND [type] <> N'R'
    )
      THROW 51021, 'Cannot provision ${RUNTIME_ROLE}: a non-role database principal uses that name.', 1;

    DECLARE @runtimeRoleMembers TABLE ([name] sysname NOT NULL);
    DECLARE @runtimeRoleSql nvarchar(max) = N'';

    IF DATABASE_PRINCIPAL_ID(N'${RUNTIME_ROLE}') IS NOT NULL
    BEGIN
      INSERT INTO @runtimeRoleMembers ([name])
      SELECT principals.[name]
      FROM sys.database_role_members AS members
      INNER JOIN sys.database_principals AS principals
        ON members.member_principal_id = principals.principal_id
      WHERE members.role_principal_id = DATABASE_PRINCIPAL_ID(N'${RUNTIME_ROLE}');

      SELECT @runtimeRoleSql +=
        N'ALTER ROLE [${RUNTIME_ROLE}] DROP MEMBER ' + QUOTENAME([name]) + N';'
      FROM @runtimeRoleMembers;
      EXEC sp_executesql @runtimeRoleSql;

      SET @runtimeRoleSql = N'';
      SELECT @runtimeRoleSql +=
        N'ALTER ROLE ' + QUOTENAME(roles.[name]) +
        N' DROP MEMBER [${RUNTIME_ROLE}];'
      FROM sys.database_role_members AS members
      INNER JOIN sys.database_principals AS roles
        ON members.role_principal_id = roles.principal_id
      WHERE members.member_principal_id = DATABASE_PRINCIPAL_ID(N'${RUNTIME_ROLE}');
      EXEC sp_executesql @runtimeRoleSql;

      DROP ROLE [${RUNTIME_ROLE}];
    END

    CREATE ROLE [${RUNTIME_ROLE}] AUTHORIZATION [dbo];

    SET @runtimeRoleSql = N'';
    SELECT @runtimeRoleSql +=
      N'ALTER ROLE [${RUNTIME_ROLE}] ADD MEMBER ' + QUOTENAME([name]) + N';'
    FROM @runtimeRoleMembers;
    EXEC sp_executesql @runtimeRoleSql;

    SET @runtimeRoleSql = N'';
    SELECT @runtimeRoleSql +=
      CASE
        WHEN tables.[name] = N'migrations' THEN
          N'GRANT SELECT ON OBJECT::' + QUOTENAME(schemas.[name]) + N'.' +
          QUOTENAME(tables.[name]) + N' TO [${RUNTIME_ROLE}];'
        ELSE
          N'GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::' +
          QUOTENAME(schemas.[name]) + N'.' + QUOTENAME(tables.[name]) +
          N' TO [${RUNTIME_ROLE}];'
      END
    FROM sys.tables AS tables
    INNER JOIN sys.schemas AS schemas
      ON tables.schema_id = schemas.schema_id
    WHERE schemas.[name] = N'dbo'
      AND tables.is_ms_shipped = 0;
    EXEC sp_executesql @runtimeRoleSql;`,
]

const DOWN_STATEMENTS = [
  `IF DATABASE_PRINCIPAL_ID(N'${RUNTIME_ROLE}') IS NOT NULL
    BEGIN
      DECLARE @runtimeRoleSql nvarchar(max) = N'';
      SELECT @runtimeRoleSql +=
        N'ALTER ROLE [${RUNTIME_ROLE}] DROP MEMBER ' +
        QUOTENAME(principals.[name]) + N';'
      FROM sys.database_role_members AS members
      INNER JOIN sys.database_principals AS principals
        ON members.member_principal_id = principals.principal_id
      WHERE members.role_principal_id = DATABASE_PRINCIPAL_ID(N'${RUNTIME_ROLE}');
      EXEC sp_executesql @runtimeRoleSql;

      SET @runtimeRoleSql = N'';
      SELECT @runtimeRoleSql +=
        N'ALTER ROLE ' + QUOTENAME(roles.[name]) +
        N' DROP MEMBER [${RUNTIME_ROLE}];'
      FROM sys.database_role_members AS members
      INNER JOIN sys.database_principals AS roles
        ON members.role_principal_id = roles.principal_id
      WHERE members.member_principal_id = DATABASE_PRINCIPAL_ID(N'${RUNTIME_ROLE}');
      EXEC sp_executesql @runtimeRoleSql;

      DROP ROLE [${RUNTIME_ROLE}];
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
