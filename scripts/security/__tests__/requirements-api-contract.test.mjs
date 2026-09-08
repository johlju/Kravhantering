import fs from 'node:fs'
import Ajv from 'ajv'
import { load as loadYaml } from 'js-yaml'
import { describe, expect, it } from 'vitest'
import {
  GeneratedOutputError,
  generatedOutputErrorResponse,
} from '@/lib/generated-output/errors'

const contract = loadYaml(
  fs.readFileSync('openapi/requirements-api.yaml', 'utf8'),
)

describe('requirements REST API contract', () => {
  it.each([
    ['actor_rate_limit', 'actor_rate_limit', { retryAfterSeconds: 59 }],
    ['actor_concurrency_limit', 'actor_concurrency_limit', { activeLimit: 1 }],
    ['capacity_busy', 'concurrency_limit', { retryAfterSeconds: 5 }],
    [
      'quota_check_unavailable',
      'quota_check_unavailable',
      { retryAfterSeconds: 5 },
    ],
    [
      'output_limit_exceeded',
      'item_limit_exceeded',
      { limit: 1000, limitKind: 'items' },
    ],
    ['generation_timeout', 'generation_timeout', { timeoutSeconds: 120 }],
    ['temporary_storage_unavailable', 'temporary_storage_unavailable', {}],
  ])(
    'accepts actual %s export failures and retry headers',
    async (code, reason, details) => {
      const response = generatedOutputErrorResponse(
        new GeneratedOutputError(code, reason, { output: 'csv', ...details }),
      )
      const documented =
        contract.paths['/api/requirements/export'].get.responses[
          response.status
        ]
      expect(documented).toBeDefined()
      const component =
        contract.components.responses[documented.$ref.split('/').at(-1)]
      const ajv = new Ajv({ strict: false })
      const validate = ajv.compile({
        ...component.content['application/json'].schema,
        components: contract.components,
      })
      expect(
        validate(await response.json()),
        JSON.stringify(validate.errors),
      ).toBe(true)
      const retry = response.headers.get('Retry-After')
      if (retry !== null) {
        expect(component.headers['Retry-After']).toBeDefined()
        expect(
          ajv.validate(component.headers['Retry-After'].schema, Number(retry)),
        ).toBe(true)
      }
    },
  )
  it('documents the HTTP runtime limit for oversized export requests', () => {
    expect(
      contract.paths['/api/requirements/export'].get.responses['431'],
    ).toEqual({
      $ref: '#/components/responses/RequestHeaderFieldsTooLarge',
    })
    expect(
      contract.components.responses.RequestHeaderFieldsTooLarge,
    ).toMatchObject({
      description: expect.stringContaining(
        'response can be generated before application routing',
      ),
    })
  })
})
