import { describe, expect, it, vi } from 'vitest'
import RuntimeRoleMigration from '@/typeorm/migrations/0054_runtime_role.mjs'

describe('runtime role migration', () => {
  it('reconciles a role without preserving excess permissions or parent roles', async () => {
    const query = vi.fn(async (_sql: string) => undefined)

    await new RuntimeRoleMigration().up({ query })

    expect(query).toHaveBeenCalledOnce()
    const sql = String(query.mock.calls[0]?.[0])
    expect(sql).toContain("AND [type] <> N'R'")
    expect(sql).toContain('DROP ROLE [kravhantering_runtime]')
    expect(sql).toContain('CREATE ROLE [kravhantering_runtime]')
    expect(sql).toContain('ALTER ROLE [kravhantering_runtime] ADD MEMBER')
    expect(sql).toContain('DROP MEMBER [kravhantering_runtime]')
    expect(sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::')
    expect(sql).toContain('GRANT SELECT ON OBJECT::')
    expect(sql).not.toContain('ON SCHEMA::[dbo]')
  })

  it('removes role memberships before rolling the custom role back', async () => {
    const query = vi.fn(async (_sql: string) => undefined)

    await new RuntimeRoleMigration().down({ query })

    expect(query).toHaveBeenCalledOnce()
    const sql = String(query.mock.calls[0]?.[0])
    expect(sql).toContain('ALTER ROLE [kravhantering_runtime] DROP MEMBER')
    expect(sql).toContain('DROP MEMBER [kravhantering_runtime]')
    expect(sql).toContain('DROP ROLE [kravhantering_runtime]')
  })
})
