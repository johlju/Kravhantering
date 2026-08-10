import type { RoleSpec } from '@/tests/support/playwright-auth'

export const RELEASE_SMOKE_USER: RoleSpec = {
  role: 'production-demo-reviewer',
  username: 'rita.reviewer',
  password: 'devpass',
  filePath: 'test-results/release-smoke/auth/production-demo-reviewer.json',
}

export const RELEASE_SMOKE_ADMIN: RoleSpec = {
  role: 'production-demo-admin',
  username: 'ada.admin',
  password: 'devpass',
  filePath: 'test-results/release-smoke/auth/production-demo-admin.json',
}

export const RELEASE_SMOKE_AUTHOR: RoleSpec = {
  role: 'production-demo-area-owner',
  username: 'olle.areaowner',
  password: 'devpass',
  filePath: 'test-results/release-smoke/auth/production-demo-area-owner.json',
}

export const RELEASE_SMOKE_ROLES = [
  RELEASE_SMOKE_USER,
  RELEASE_SMOKE_AUTHOR,
  RELEASE_SMOKE_ADMIN,
]
