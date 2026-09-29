import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RequestContext } from '@/lib/requirements/auth'
import { forbiddenError } from '@/lib/requirements/errors'
import { buildRequirementImportReferenceDataFile } from '@/lib/requirements/import-reference-data-file'

const routeMocks = vi.hoisted(() => ({
  createRequirementsRestRuntime: vi.fn(),
  getImportReferenceDataFile: vi.fn(),
}))

vi.mock('@/lib/requirements/server', () => ({
  createRequirementsRestRuntime: routeMocks.createRequirementsRestRuntime,
}))

import { GET } from '@/app/api/requirements/import/reference-data/route'

const ROUTE_URL = 'http://localhost/api/requirements/import/reference-data'

const REFERENCE_DATA_FILE = buildRequirementImportReferenceDataFile({
  destination: { kind: 'requirements_library' },
  generatedAt: new Date('2026-09-29T08:30:00.000Z'),
  locale: 'sv',
  referenceData: {
    categories: [{ id: 1, name: 'Säkerhet' }],
    normReferences: [],
  },
})

function makeContext(isAuthenticated: boolean): RequestContext {
  return {
    actor: {
      displayName: isAuthenticated ? 'Route Tester' : '',
      hsaId: isAuthenticated ? 'SE5560000001-route' : null,
      id: isAuthenticated ? 'route-test' : null,
      isAuthenticated,
      roles: isAuthenticated ? ['RequirementsEditor'] : [],
      source: isAuthenticated ? 'oidc' : 'anonymous',
    },
    correlationId: 'correlation-reference-data',
    requestId: 'request-reference-data',
    source: 'rest',
  }
}

function useRuntime(isAuthenticated = true) {
  const context = makeContext(isAuthenticated)
  routeMocks.createRequirementsRestRuntime.mockResolvedValue({
    context,
    service: {
      getImportReferenceDataFile: routeMocks.getImportReferenceDataFile,
    },
  })
  return context
}

describe('GET /api/requirements/import/reference-data', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routeMocks.getImportReferenceDataFile.mockResolvedValue(REFERENCE_DATA_FILE)
  })

  it('returns minified JSON without a BOM and with no-store', async () => {
    const context = useRuntime()

    const response = await GET(
      new Request(`${ROUTE_URL}?locale=sv&kind=requirements_library`),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Content-Type')).toBe(
      'application/json; charset=utf-8',
    )
    const bytes = new Uint8Array(await response.arrayBuffer())
    expect(bytes[0]).toBe('{'.charCodeAt(0))
    const body = new TextDecoder().decode(bytes)
    expect(body).toBe(JSON.stringify(REFERENCE_DATA_FILE))
    expect(body).not.toContain('\n')
    expect(Object.keys(JSON.parse(body))).toEqual([
      'generatedAt',
      'schemaVersion',
      'locale',
      'destination',
      'referenceData',
    ])
    expect(routeMocks.getImportReferenceDataFile).toHaveBeenCalledWith(
      context,
      { destination: { kind: 'requirements_library' }, locale: 'sv' },
    )
  })

  it('defaults to English for other locales', async () => {
    const context = useRuntime()

    await GET(new Request(`${ROUTE_URL}?locale=de&kind=requirements_library`))

    expect(routeMocks.getImportReferenceDataFile).toHaveBeenCalledWith(
      context,
      { destination: { kind: 'requirements_library' }, locale: 'en' },
    )
  })

  it.each([
    ['a missing kind', '?locale=sv'],
    ['an unknown kind', '?kind=requirements_area'],
    ['a specification without an id', '?kind=requirements_specification'],
    [
      'a specification without a positive integer id',
      '?kind=requirements_specification&specificationId=0',
    ],
  ])('rejects %s as a missing destination', async (_name, query) => {
    useRuntime()

    const response = await GET(new Request(`${ROUTE_URL}${query}`))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: 'validation',
      error: expect.stringContaining('destination is required'),
    })
    expect(routeMocks.getImportReferenceDataFile).not.toHaveBeenCalled()
  })

  it('rejects requirements specification destinations it does not serve', async () => {
    useRuntime()

    const response = await GET(
      new Request(
        `${ROUTE_URL}?kind=requirements_specification&specificationId=8`,
      ),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: 'validation',
      error: expect.stringContaining('requirements_library'),
    })
    expect(routeMocks.getImportReferenceDataFile).not.toHaveBeenCalled()
  })

  it('rejects anonymous requests before loading reference data', async () => {
    useRuntime(false)

    const response = await GET(
      new Request(`${ROUTE_URL}?kind=requirements_library`),
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      code: 'unauthorized',
      error: 'Authentication is required',
    })
    expect(routeMocks.getImportReferenceDataFile).not.toHaveBeenCalled()
  })

  it('returns the service authorization failure', async () => {
    useRuntime()
    routeMocks.getImportReferenceDataFile.mockRejectedValue(forbiddenError())

    const response = await GET(
      new Request(`${ROUTE_URL}?kind=requirements_library`),
    )

    expect(response.status).toBe(403)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
})
