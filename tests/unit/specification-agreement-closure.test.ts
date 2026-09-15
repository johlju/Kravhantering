import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recordAllowedActionAuditEvent } from '@/lib/audit/action-audit'
import type { RequestContext } from '@/lib/requirements/auth'
import { createSpecificationAgreementWorkflow } from '@/lib/specifications/agreements'
import { withEditableAgreementState } from '../support/editable-agreement-database'

vi.mock('@/lib/audit/action-audit', () => ({
  recordAllowedActionAuditEvent: vi.fn(),
}))

const now = new Date('2026-09-15T12:00:00Z')
const context: RequestContext = {
  actor: {
    id: 'owner',
    hsaId: 'SE5560000001-owner',
    displayName: 'Owner',
    isAuthenticated: true,
    roles: [],
    source: 'oidc',
  },
  correlationId: 'closure-test',
  requestId: 'closure-test',
  source: 'rest',
}
const input = {
  operation: 'close_deviation' as const,
  itemRef: 'lib:3',
  deviationId: 10,
  agreementId: 7,
  reason: 'Implemented controls',
}

function setup() {
  const query = vi
    .fn()
    .mockResolvedValueOnce([{ responsibleHsaId: context.actor.hsaId }])
    .mockResolvedValueOnce([{ hsaId: 'SE5560000001-author' }])
    .mockResolvedValueOnce([{ id: 10 }])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: 10 }])
    .mockResolvedValueOnce([{ id: 10 }])
    .mockResolvedValue([])
  const manager = { query: withEditableAgreementState(query) }
  const transaction = vi.fn(
    async (work: (executor: typeof manager) => Promise<unknown>) =>
      work(manager),
  )
  const workflow = createSpecificationAgreementWorkflow(
    { transaction } as unknown as Parameters<
      typeof createSpecificationAgreementWorkflow
    >[0],
    { now: () => now },
  )
  return { query, manager, transaction, workflow }
}

describe('agreement closure authorization and transaction boundary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lets the assigned responsible person close permission and audits inside the same transaction', async () => {
    const { workflow, query, transaction, manager } = setup()
    await workflow.mutate(context, 2, input)
    expect(transaction).toHaveBeenCalledOnce()
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('UPDLOCK, HOLDLOCK'),
      [2],
    )
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("'closed'"),
      [
        2,
        10,
        '2026-09-15',
        now,
        context.actor.hsaId,
        'Owner',
        'Implemented controls',
      ],
    )
    expect(recordAllowedActionAuditEvent).toHaveBeenCalledWith(
      manager,
      context,
      {
        action: 'specification.agreement.close_deviation',
        targetId: 2,
        targetKind: 'RequirementsSpecification',
        details: {
          operation: 'close_deviation',
          agreementId: 7,
          itemRef: 'lib:3',
        },
      },
    )
  })

  it.each([
    { roles: ['Admin'], hsaId: 'SE5560000001-admin', isAuthenticated: true },
    {
      roles: ['Reviewer'],
      hsaId: 'SE5560000001-reviewer',
      isAuthenticated: true,
    },
    { roles: [], hsaId: 'SE5560000001-author', isAuthenticated: true },
    { roles: [], hsaId: context.actor.hsaId, isAuthenticated: false },
  ])('requires authenticated assignment for closure: %j', async actor => {
    const { workflow, query } = setup()
    await expect(
      workflow.mutate(
        { ...context, actor: { ...context.actor, ...actor } },
        2,
        input,
      ),
    ).rejects.toMatchObject({ code: 'forbidden' })
    expect(query).toHaveBeenCalledTimes(2)
    expect(recordAllowedActionAuditEvent).not.toHaveBeenCalled()
  })

  it('rejects an empty closure reason before entering the transaction', async () => {
    const { workflow, transaction } = setup()
    await expect(
      workflow.mutate(context, 2, { ...input, reason: ' ' }),
    ).rejects.toThrow()
    expect(transaction).not.toHaveBeenCalled()
  })

  it('propagates audit failure to the enclosing transaction', async () => {
    const { workflow } = setup()
    vi.mocked(recordAllowedActionAuditEvent).mockRejectedValueOnce(
      new Error('Audit failed'),
    )
    await expect(workflow.mutate(context, 2, input)).rejects.toThrow(
      'Audit failed',
    )
  })
})

describe('approval applicability in agreement views', () => {
  it.each([
    { transition: {}, expected: 'expired', state: 'current' },
    {
      transition: { replacedAt: new Date('2026-09-05') },
      expected: 'applicable',
      state: 'previous',
    },
    {
      transition: { endedAt: new Date('2026-09-05') },
      expected: 'applicable',
      state: 'ended',
    },
    {
      transition: { cancelledAt: new Date('2026-09-05') },
      expected: 'applicable',
      state: 'cancelled',
    },
  ])(
    'evaluates the approval at the $state agreement cutoff',
    async ({ transition, expected, state }) => {
      const approval = {
        id: 10,
        itemRef: 'lib:3',
        decision: 1,
        decidedAt: new Date('2026-09-01'),
        validThrough: '2026-09-10',
        conditions: 'Weekly review',
        motivation: 'Temporary departure',
      }
      const query = vi
        .fn()
        .mockResolvedValueOnce([{ responsibleHsaId: context.actor.hsaId }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { itemRef: 'lib:3', validFrom: new Date('2026-01-01') },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 7,
            agreementReference: 'A',
            activatedAt: new Date('2026-01-01'),
            ...transition,
          },
        ])
        .mockResolvedValueOnce([{ itemRef: 'lib:3' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([approval])
        .mockResolvedValue([])
      const transaction = async (
        work: (executor: { query: typeof query }) => Promise<unknown>,
      ) => work({ query })
      const workflow = createSpecificationAgreementWorkflow(
        { transaction } as unknown as Parameters<
          typeof createSpecificationAgreementWorkflow
        >[0],
        { now: () => now },
      )
      const result = await workflow.read(context, 2, {
        agreementId: 7,
        itemRefs: ['lib:3'],
      })
      expect(result.selectedAgreement).toMatchObject({ id: 7, state })
      expect(result.deviations).toEqual([
        { ...approval, applicability: expected },
      ])
      expect(result.items).toEqual([
        expect.objectContaining({ itemRef: 'lib:3' }),
      ])
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('FROM deviations d'),
        [2, '["lib:3"]'],
      )
    },
  )
})
