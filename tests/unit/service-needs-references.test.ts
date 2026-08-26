import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createSpecificationNeedsReference,
  deleteSpecificationNeedsReference,
  findSpecificationIdentity,
  getSpecificationNeedsReference,
  listSpecificationNeedsReferences,
  type SpecificationNeedsReferenceSummary,
  updateSpecificationNeedsReference,
} from '@/lib/dal/requirements-specifications'
import {
  AssignmentBasedAuthorizationService,
  type AssignmentLookup,
} from '@/lib/requirements/assignment-authorization'
import type { RequestContext } from '@/lib/requirements/auth'
import { conflictError } from '@/lib/requirements/errors'
import { createNeedsReferenceWorkflow } from '@/lib/requirements/service-needs-references'

const mocks = vi.hoisted(() => ({
  createSpecificationNeedsReference: vi.fn(),
  deleteSpecificationNeedsReference: vi.fn(),
  findSpecificationIdentity: vi.fn(),
  getSpecificationNeedsReference: vi.fn(),
  listSpecificationNeedsReferences: vi.fn(),
  updateSpecificationNeedsReference: vi.fn(),
}))

vi.mock('@/lib/dal/requirements-specifications', () => ({
  createSpecificationNeedsReference: mocks.createSpecificationNeedsReference,
  deleteSpecificationNeedsReference: mocks.deleteSpecificationNeedsReference,
  findSpecificationIdentity: mocks.findSpecificationIdentity,
  getSpecificationNeedsReference: mocks.getSpecificationNeedsReference,
  listSpecificationNeedsReferences: mocks.listSpecificationNeedsReferences,
  updateSpecificationNeedsReference: mocks.updateSpecificationNeedsReference,
}))

function makeContext(): RequestContext {
  return {
    actor: {
      displayName: 'Needs Reference Actor',
      hsaId: 'SE5560000001-needs1',
      id: 'actor-needs-reference',
      isAuthenticated: true,
      roles: ['Admin'],
      source: 'mcp',
    },
    correlationId: 'corr-needs-reference',
    requestId: 'req-needs-reference',
    source: 'mcp',
    toolName: 'requirements_manage_needs_reference',
  }
}

function needsReferenceRow(
  overrides: Partial<SpecificationNeedsReferenceSummary> = {},
): SpecificationNeedsReferenceSummary {
  return {
    createdAt: '2026-07-05T10:00:00.000Z',
    description: 'Stödjer införande av GDPR artikel 32.',
    id: 12,
    libraryItemCount: 1,
    linkedItemCount: 2,
    specificationLocalRequirementCount: 1,
    text: 'Personuppgiftsbehandling behöver tekniskt skydd',
    updatedAt: '2026-07-05T10:00:00.000Z',
    ...overrides,
  }
}

function assignmentAuthorization(
  assignedHsaId: string,
): AssignmentBasedAuthorizationService {
  const lookup = {
    isRequirementAreaAuthor: vi.fn(async () => false),
    isSpecificationAuthor: vi.fn(
      async (_specificationId: number, actorHsaId: string) =>
        actorHsaId === assignedHsaId,
    ),
    resolveDeviationTarget: vi.fn(),
    resolveRequirementApplicationMutationTarget: vi.fn(),
    resolveRequirementSelectionQuestionArea: vi.fn(),
    resolveRequirementTarget: vi.fn(),
    resolveRfiQuestionArea: vi.fn(),
    resolveRfiQuestionSuggestionArea: vi.fn(),
    resolveSpecificationChildTarget: vi.fn(),
    resolveSpecificationId: vi.fn(
      async (input: { specificationId?: number }) => input.specificationId ?? 8,
    ),
    resolveSpecificationIdForLocalRequirement: vi.fn(),
    resolveSuggestionRequirementArea: vi.fn(),
    resolveSuggestionRequirementTarget: vi.fn(),
  } as unknown as AssignmentLookup
  return new AssignmentBasedAuthorizationService(lookup)
}

describe('needs reference service workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(findSpecificationIdentity).mockResolvedValue({ id: 8 })
    vi.mocked(getSpecificationNeedsReference).mockResolvedValue(null)
    vi.mocked(listSpecificationNeedsReferences).mockResolvedValue([])
  })

  it('lists specification-scoped needs references sorted by text', async () => {
    const authorization = { assertAuthorized: vi.fn() }
    const logger = { error: vi.fn(), info: vi.fn() }
    const rows = [
      needsReferenceRow({ id: 2, text: 'Zeta behov' }),
      needsReferenceRow({ id: 1, text: 'Alfa behov' }),
    ]
    vi.mocked(listSpecificationNeedsReferences).mockResolvedValue(rows)
    const workflow = createNeedsReferenceWorkflow({
      authorization,
      db: {} as never,
      logger,
    })

    const result = await workflow.manageNeedsReference(makeContext(), {
      operation: 'list',
      specificationId: 8,
    })

    expect(result).toMatchObject({
      needsReferences: [
        { id: 1, text: 'Alfa behov' },
        { id: 2, text: 'Zeta behov' },
      ],
    })
    expect(listSpecificationNeedsReferences).toHaveBeenCalledWith(
      expect.anything(),
      8,
    )
    expect(authorization.assertAuthorized).toHaveBeenCalledWith(
      {
        kind: 'manage_specification_needs_reference',
        operation: 'list',
        specificationId: 8,
      },
      expect.objectContaining({
        toolName: 'requirements_manage_needs_reference',
      }),
    )
  })

  it('searches needs references with transport-neutral match metadata', async () => {
    const authorization = { assertAuthorized: vi.fn() }
    const logger = { error: vi.fn(), info: vi.fn() }
    vi.mocked(listSpecificationNeedsReferences).mockResolvedValue([
      needsReferenceRow({ description: null, id: 2, text: 'Arkivering' }),
      needsReferenceRow({
        id: 1,
        description: 'Stödjer GDPR artikel 32.',
        text: 'Personuppgiftsbehandling',
      }),
    ])
    const workflow = createNeedsReferenceWorkflow({
      authorization,
      db: {} as never,
      logger,
    })

    const result = await workflow.manageNeedsReference(makeContext(), {
      operation: 'search',
      search: 'gdpr',
      specificationId: 8,
    })

    expect(result).toEqual({
      needsReferenceMatches: [
        {
          match: { matchedFields: ['description'], quality: 'contains' },
          needsReference: needsReferenceRow({
            id: 1,
            description: 'Stödjer GDPR artikel 32.',
            text: 'Personuppgiftsbehandling',
          }),
        },
      ],
    })
  })

  it('gets one needs reference inside the selected specification', async () => {
    const authorization = { assertAuthorized: vi.fn() }
    const logger = { error: vi.fn(), info: vi.fn() }
    const row = needsReferenceRow({ id: 12 })
    vi.mocked(getSpecificationNeedsReference).mockResolvedValue(row)
    const workflow = createNeedsReferenceWorkflow({
      authorization,
      db: {} as never,
      logger,
    })

    const result = await workflow.manageNeedsReference(makeContext(), {
      needsReferenceId: 12,
      operation: 'get',
      specificationId: 8,
    })

    expect(result).toEqual({ needsReference: row })
    expect(getSpecificationNeedsReference).toHaveBeenCalledWith(
      expect.anything(),
      8,
      12,
    )
    expect(listSpecificationNeedsReferences).not.toHaveBeenCalled()
  })

  it('uses the direct lookup not-found path for one needs reference', async () => {
    const authorization = { assertAuthorized: vi.fn() }
    const logger = { error: vi.fn(), info: vi.fn() }
    const workflow = createNeedsReferenceWorkflow({
      authorization,
      db: {} as never,
      logger,
    })

    await expect(
      workflow.manageNeedsReference(makeContext(), {
        needsReferenceId: 99,
        operation: 'get',
        specificationId: 8,
      }),
    ).rejects.toMatchObject({
      code: 'not_found',
      message: 'Needs reference not found',
    })

    expect(getSpecificationNeedsReference).toHaveBeenCalledWith(
      expect.anything(),
      8,
      99,
    )
    expect(listSpecificationNeedsReferences).not.toHaveBeenCalled()
  })

  it('identifies a missing requirements specification before reading needs references', async () => {
    const authorization = { assertAuthorized: vi.fn() }
    const logger = { error: vi.fn(), info: vi.fn() }
    vi.mocked(findSpecificationIdentity).mockResolvedValue(null)
    const workflow = createNeedsReferenceWorkflow({
      authorization,
      db: {} as never,
      logger,
    })

    await expect(
      workflow.manageNeedsReference(makeContext(), {
        operation: 'list',
        specificationId: 404,
      }),
    ).rejects.toMatchObject({
      code: 'not_found',
      details: { specificationId: 404 },
      message: 'Requirements specification not found',
    })
    expect(listSpecificationNeedsReferences).not.toHaveBeenCalled()
  })

  it('creates a needs reference in one specification', async () => {
    const authorization = { assertAuthorized: vi.fn() }
    const logger = { error: vi.fn(), info: vi.fn() }
    const db = {} as never
    const row = needsReferenceRow({ id: 14, text: 'IAM-42' })
    vi.mocked(createSpecificationNeedsReference).mockResolvedValue(row)
    const workflow = createNeedsReferenceWorkflow({
      authorization,
      db,
      logger,
    })

    const result = await workflow.manageNeedsReference(makeContext(), {
      description: 'Access management work',
      operation: 'create',
      specificationId: 8,
      text: 'IAM-42',
    })

    expect(result).toEqual({ needsReference: row })
    expect(createSpecificationNeedsReference).toHaveBeenCalledWith(db, 8, {
      description: 'Access management work',
      text: 'IAM-42',
    })
  })

  it('creates a needs reference with a null description when omitted', async () => {
    const authorization = { assertAuthorized: vi.fn() }
    const logger = { error: vi.fn(), info: vi.fn() }
    const db = {} as never
    const row = needsReferenceRow({ description: null, id: 15 })
    vi.mocked(createSpecificationNeedsReference).mockResolvedValue(row)
    const workflow = createNeedsReferenceWorkflow({ authorization, db, logger })

    await expect(
      workflow.manageNeedsReference(makeContext(), {
        operation: 'create',
        specificationId: 8,
        text: 'Unspecified context',
      }),
    ).resolves.toEqual({ needsReference: row })
    expect(createSpecificationNeedsReference).toHaveBeenCalledWith(db, 8, {
      description: null,
      text: 'Unspecified context',
    })
  })

  it('updates a needs reference in one specification', async () => {
    const authorization = { assertAuthorized: vi.fn() }
    const logger = { error: vi.fn(), info: vi.fn() }
    const db = {} as never
    const row = needsReferenceRow({
      description: 'Updated context',
      id: 12,
      text: 'Updated need',
    })
    vi.mocked(updateSpecificationNeedsReference).mockResolvedValue(row)
    const workflow = createNeedsReferenceWorkflow({ authorization, db, logger })

    const result = await workflow.manageNeedsReference(makeContext(), {
      description: 'Updated context',
      needsReferenceId: 12,
      operation: 'update',
      specificationId: 8,
      text: 'Updated need',
    })

    expect(result).toEqual({ needsReference: row })
    expect(updateSpecificationNeedsReference).toHaveBeenCalledWith(db, 8, 12, {
      description: 'Updated context',
      text: 'Updated need',
    })
  })

  it('deletes an unused needs reference in one specification', async () => {
    const authorization = { assertAuthorized: vi.fn() }
    const logger = { error: vi.fn(), info: vi.fn() }
    const db = {} as never
    vi.mocked(deleteSpecificationNeedsReference).mockResolvedValue(true)
    const workflow = createNeedsReferenceWorkflow({ authorization, db, logger })

    const result = await workflow.manageNeedsReference(makeContext(), {
      needsReferenceId: 12,
      operation: 'delete',
      specificationId: 8,
    })

    expect(result).toEqual({ deletedNeedsReferenceId: 12 })
    expect(deleteSpecificationNeedsReference).toHaveBeenCalledWith(db, 8, 12)
  })

  it('identifies a missing needs reference during deletion', async () => {
    const authorization = { assertAuthorized: vi.fn() }
    const logger = { error: vi.fn(), info: vi.fn() }
    vi.mocked(deleteSpecificationNeedsReference).mockResolvedValue(false)
    const workflow = createNeedsReferenceWorkflow({
      authorization,
      db: {} as never,
      logger,
    })

    await expect(
      workflow.manageNeedsReference(makeContext(), {
        needsReferenceId: 99,
        operation: 'delete',
        specificationId: 8,
      }),
    ).rejects.toMatchObject({
      code: 'not_found',
      details: { needsReferenceId: 99, specificationId: 8 },
      message: 'Needs reference not found',
    })
  })

  it.each([
    [
      'duplicate text during creation',
      'create',
      conflictError('Needs reference already exists in this specification', {
        reason: 'duplicate_needs_reference',
      }),
    ],
    [
      'linked items during deletion',
      'delete',
      conflictError(
        'Needs reference is used by requirement applications or unique requirements',
        { linkedItemCount: 2, reason: 'needs_reference_in_use' },
      ),
    ],
  ] as const)('preserves the %s conflict', async (_name, operation, error) => {
    const authorization = { assertAuthorized: vi.fn() }
    const logger = { error: vi.fn(), info: vi.fn() }
    if (operation === 'create') {
      vi.mocked(createSpecificationNeedsReference).mockRejectedValueOnce(error)
    } else {
      vi.mocked(deleteSpecificationNeedsReference).mockRejectedValueOnce(error)
    }
    const workflow = createNeedsReferenceWorkflow({
      authorization,
      db: {} as never,
      logger,
    })

    const result =
      operation === 'create'
        ? workflow.manageNeedsReference(makeContext(), {
            operation,
            specificationId: 8,
            text: 'Duplicate need',
          })
        : workflow.manageNeedsReference(makeContext(), {
            needsReferenceId: 12,
            operation,
            specificationId: 8,
          })

    await expect(result).rejects.toBe(error)
    expect(logger.info).toHaveBeenCalledWith(
      'requirements.manage_needs_reference.failed',
      expect.objectContaining({ operation }),
    )
  })

  it('allows Reviewer reads but requires assignment for writes through the shared interface', async () => {
    const logger = { error: vi.fn(), info: vi.fn() }
    const authorization = assignmentAuthorization(
      'SE5560000001-assigned-needs-reference',
    )
    const workflow = createNeedsReferenceWorkflow({
      authorization,
      db: {} as never,
      logger,
    })
    const reviewer = makeContext()
    reviewer.actor.roles = ['Reviewer']
    reviewer.actor.hsaId = 'SE5560000001-reviewer-needs-reference'

    await expect(
      workflow.manageNeedsReference(reviewer, {
        operation: 'list',
        specificationId: 8,
      }),
    ).resolves.toEqual({ needsReferences: [] })

    await expect(
      workflow.manageNeedsReference(reviewer, {
        operation: 'create',
        specificationId: 8,
        text: 'Reviewer cannot create',
      }),
    ).rejects.toMatchObject({
      code: 'forbidden',
      details: { reason: 'specification_author_required' },
    })
    expect(createSpecificationNeedsReference).not.toHaveBeenCalled()

    const assignedActor = makeContext()
    assignedActor.actor.roles = []
    assignedActor.actor.hsaId = 'SE5560000001-assigned-needs-reference'
    const created = needsReferenceRow({ id: 16, text: 'Assigned creation' })
    vi.mocked(createSpecificationNeedsReference).mockResolvedValue(created)
    await expect(
      workflow.manageNeedsReference(assignedActor, {
        operation: 'create',
        specificationId: 8,
        text: 'Assigned creation',
      }),
    ).resolves.toEqual({ needsReference: created })
  })

  it('rejects empty search text before listing rows', async () => {
    const authorization = { assertAuthorized: vi.fn() }
    const logger = { error: vi.fn(), info: vi.fn() }
    const workflow = createNeedsReferenceWorkflow({
      authorization,
      db: {} as never,
      logger,
    })

    await expect(
      workflow.manageNeedsReference(makeContext(), {
        operation: 'search',
        search: '   ',
        specificationId: 8,
      }),
    ).rejects.toMatchObject({
      code: 'validation',
      message: 'Search text is required',
    })

    expect(listSpecificationNeedsReferences).not.toHaveBeenCalled()
  })
})
