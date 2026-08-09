import { describe, expect, it } from 'vitest'
import {
  buildSmokeBundleInputs,
  parseArgs,
} from '../containers/prepare-production-smoke-bundle.mjs'

const IMAGE_ID = `sha256:${'a'.repeat(64)}`
const DB_IMAGE_ID = `sha256:${'b'.repeat(64)}`

function values(overrides = {}) {
  return {
    'app-image-id': IMAGE_ID,
    'app-ref': 'localhost/kravhantering/app-runtime:pr-42',
    'commit-sha': '1234567890abcdef',
    'db-job-image-id': DB_IMAGE_ID,
    'db-job-ref': 'localhost/kravhantering/db-job:pr-42',
    'output-dir': 'tmp/production-smoke/deployment',
    'run-id': '42',
    'stack-lock': 'container-stack.lock.json',
    version: '0.1.0-pr.42',
    ...overrides,
  }
}

describe('production smoke bundle preparation', () => {
  it('parses the explicit production archive contract', () => {
    expect(
      parseArgs(
        Object.entries(values()).flatMap(([key, value]) => [`--${key}`, value]),
      ),
    ).toEqual(values())
  })

  it('builds release-shaped metadata from exact candidate image IDs', () => {
    const result = buildSmokeBundleInputs(values(), {
      fsImpl: {
        readFileSync: () =>
          JSON.stringify({ expectedDatabaseSchemaVersion: 'Schema123' }),
      },
    })

    expect(result.plan).toMatchObject({
      commitSha: '1234567890abcdef',
      expectedDatabaseSchemaVersion: 'Schema123',
      runId: '42',
      version: '0.1.0-pr.42',
    })
    expect(result.metadata).toEqual({
      appRuntime: {
        imageId: IMAGE_ID,
        manifestDigest: IMAGE_ID,
        manifestRef: `localhost/kravhantering/app-runtime:pr-42@${IMAGE_ID}`,
      },
      database: { expectedSchemaVersion: 'Schema123' },
      dbJob: {
        imageId: DB_IMAGE_ID,
        manifestDigest: DB_IMAGE_ID,
        manifestRef: `localhost/kravhantering/db-job:pr-42@${DB_IMAGE_ID}`,
      },
    })
  })

  it('rejects incomplete and malformed image identity inputs', () => {
    expect(() => parseArgs(['--version', '1.0.0'])).toThrow(
      'Missing --commit-sha.',
    )
    expect(() =>
      buildSmokeBundleInputs(values({ 'app-image-id': 'latest' }), {
        fsImpl: {
          readFileSync: () =>
            JSON.stringify({ expectedDatabaseSchemaVersion: 'Schema123' }),
        },
      }),
    ).toThrow('Invalid image ID: latest')
  })
})
