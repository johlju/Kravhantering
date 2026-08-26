import {
  createSpecificationNeedsReference,
  deleteSpecificationNeedsReference,
  findSpecificationIdentity,
  getSpecificationNeedsReference,
  listSpecificationNeedsReferences,
  type SpecificationNeedsReferenceSummary,
  updateSpecificationNeedsReference,
} from '@/lib/dal/requirements-specifications'
import type { SqlServerDatabase } from '@/lib/db'
import type {
  AuthorizationService,
  RequestContext,
} from '@/lib/requirements/auth'
import { notFoundError, validationError } from '@/lib/requirements/errors'
import type { RequirementsLogger } from '@/lib/requirements/logging'
import {
  compareSearchMatches,
  findSearchMatch,
  type SearchMatch,
} from '@/lib/requirements/search-match'
import type { RequirementsService } from '@/lib/requirements/service'
import { authorize, withLogging } from '@/lib/requirements/service-shared'

export type NeedsReferenceWorkflowInput =
  | {
      operation: 'list'
      specificationId: number
    }
  | {
      operation: 'search'
      search: string
      specificationId: number
    }
  | {
      needsReferenceId: number
      operation: 'get'
      specificationId: number
    }
  | {
      description?: string | null
      operation: 'create'
      specificationId: number
      text: string
    }
  | {
      description?: string | null
      needsReferenceId: number
      operation: 'update'
      specificationId: number
      text: string
    }
  | {
      needsReferenceId: number
      operation: 'delete'
      specificationId: number
    }

export type NeedsReferenceWorkflowOutput =
  | {
      deletedNeedsReferenceId: number
    }
  | {
      needsReference: SpecificationNeedsReferenceSummary
    }
  | {
      needsReferences: SpecificationNeedsReferenceSummary[]
    }

interface NeedsReferenceWorkflowDependencies {
  authorization: AuthorizationService
  db: SqlServerDatabase
  logger: RequirementsLogger
}

function compareNeedsReferences(
  left: SpecificationNeedsReferenceSummary,
  right: SpecificationNeedsReferenceSummary,
): number {
  return left.text.localeCompare(right.text, 'sv') || left.id - right.id
}

function findNeedsReferenceMatch(
  row: SpecificationNeedsReferenceSummary,
  search: string,
): SearchMatch | null {
  return findSearchMatch(
    {
      description: row.description,
      id: row.id,
      text: row.text,
    },
    search,
  )
}

async function listNeedsReferences(
  dependencies: NeedsReferenceWorkflowDependencies,
  specificationId: number,
): Promise<SpecificationNeedsReferenceSummary[]> {
  return (
    await listSpecificationNeedsReferences(dependencies.db, specificationId)
  ).sort(compareNeedsReferences)
}

export function createNeedsReferenceWorkflow(
  dependencies: NeedsReferenceWorkflowDependencies,
): Pick<RequirementsService, 'manageNeedsReference'> {
  const { authorization, db, logger } = dependencies
  return {
    async manageNeedsReference(context: RequestContext, input) {
      await authorize(
        authorization,
        {
          kind: 'manage_specification_needs_reference',
          operation: input.operation,
          specificationId: input.specificationId,
          needsReferenceId:
            'needsReferenceId' in input ? input.needsReferenceId : undefined,
        },
        context,
      )

      return withLogging(
        logger,
        context,
        'requirements.manage_needs_reference',
        {
          operation: input.operation,
          specification_id: input.specificationId,
        },
        async (): Promise<NeedsReferenceWorkflowOutput> => {
          const specification = await findSpecificationIdentity(
            db,
            input.specificationId,
          )
          if (!specification) {
            throw notFoundError('Requirements specification not found', {
              specificationId: input.specificationId,
            })
          }

          if (input.operation === 'create') {
            return {
              needsReference: await createSpecificationNeedsReference(
                db,
                input.specificationId,
                {
                  description: input.description ?? null,
                  text: input.text,
                },
              ),
            }
          }

          if (input.operation === 'update') {
            return {
              needsReference: await updateSpecificationNeedsReference(
                db,
                input.specificationId,
                input.needsReferenceId,
                {
                  description: input.description ?? null,
                  text: input.text,
                },
              ),
            }
          }

          if (input.operation === 'delete') {
            const deleted = await deleteSpecificationNeedsReference(
              db,
              input.specificationId,
              input.needsReferenceId,
            )
            if (!deleted) {
              throw notFoundError('Needs reference not found', {
                needsReferenceId: input.needsReferenceId,
                specificationId: input.specificationId,
              })
            }
            return { deletedNeedsReferenceId: input.needsReferenceId }
          }

          const search = input.operation === 'search' ? input.search.trim() : ''
          if (input.operation === 'search' && !search) {
            throw validationError('Search text is required')
          }

          if (input.operation === 'get') {
            const row = await getSpecificationNeedsReference(
              db,
              input.specificationId,
              input.needsReferenceId,
            )
            if (!row) {
              throw notFoundError('Needs reference not found', {
                needsReferenceId: input.needsReferenceId,
                specificationId: input.specificationId,
              })
            }
            return { needsReference: row }
          }

          const rows = await listNeedsReferences(
            dependencies,
            input.specificationId,
          )

          if (input.operation === 'list') {
            return { needsReferences: rows }
          }

          const matched = rows
            .flatMap(
              (
                row,
              ): Array<{
                match: SearchMatch
                needsReference: SpecificationNeedsReferenceSummary
              }> => {
                const match = findNeedsReferenceMatch(row, search)
                return match ? [{ match, needsReference: row }] : []
              },
            )
            .sort(
              (left, right) =>
                compareSearchMatches(left.match, right.match) ||
                compareNeedsReferences(
                  left.needsReference,
                  right.needsReference,
                ),
            )

          return {
            needsReferences: matched.map(
              ({ needsReference }) => needsReference,
            ),
          }
        },
      )
    },
  }
}
