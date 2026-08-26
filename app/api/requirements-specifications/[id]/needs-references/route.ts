import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  requirementsMutationPolicy,
  secureMutationRoute,
} from '@/lib/http/secure-mutation-route'
import {
  boundedDbStringSchema,
  idParamSchema,
  nullableBusinessTextSchema,
  parseRouteParams,
  positiveIntegerSchema,
} from '@/lib/http/validation'
import { toHttpErrorPayload } from '@/lib/requirements/http-errors'
import { createRequirementsRestRuntime } from '@/lib/requirements/server'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

const specificationParamSchema = idParamSchema

const createNeedsReferenceSchema = z
  .object({
    description: nullableBusinessTextSchema.optional(),
    text: boundedDbStringSchema,
  })
  .strict()

const updateNeedsReferenceSchema = z
  .object({
    description: nullableBusinessTextSchema.optional(),
    id: positiveIntegerSchema,
    text: boundedDbStringSchema,
  })
  .strict()

const deleteNeedsReferenceSchema = z
  .object({
    id: positiveIntegerSchema,
  })
  .strict()

export async function GET(
  request: NextRequest,
  { params }: { params: Params },
) {
  const parsedParams = await parseRouteParams(params, specificationParamSchema)
  if (!parsedParams.ok) {
    return parsedParams.response
  }
  try {
    const { id } = parsedParams.data
    const { context, service } = await createRequirementsRestRuntime(request)
    const payload = await service.manageNeedsReference(context, {
      operation: 'list',
      specificationId: id,
    })
    if (!('needsReferences' in payload)) {
      throw new Error('Needs-reference list returned an invalid outcome')
    }
    const { needsReferences } = payload
    return NextResponse.json({ needsReferences })
  } catch (error) {
    const { body, status } = toHttpErrorPayload(error)
    return NextResponse.json(body, { status })
  }
}

export const POST = secureMutationRoute<
  z.infer<typeof createNeedsReferenceSchema>,
  z.infer<typeof specificationParamSchema>
>({
  bodySchema: createNeedsReferenceSchema,
  paramsSchema: specificationParamSchema,
  policy: requirementsMutationPolicy<
    z.infer<typeof createNeedsReferenceSchema>,
    z.infer<typeof specificationParamSchema>
  >(({ params }) => ({
    kind: 'manage_specification_needs_reference',
    operation: 'create',
    specificationId: params.id,
  })),
  handler: async ({ body, context, db, params, request }) => {
    const { service } = await createRequirementsRestRuntime(request, {
      context,
      db,
    })
    const payload = await service.manageNeedsReference(context, {
      description: body.description ?? null,
      operation: 'create',
      specificationId: params.id,
      text: body.text,
    })
    if (!('needsReference' in payload)) {
      throw new Error('Needs-reference create returned an invalid outcome')
    }
    const { needsReference } = payload
    return NextResponse.json({ needsReference, ok: true }, { status: 201 })
  },
})

export const PATCH = secureMutationRoute<
  z.infer<typeof updateNeedsReferenceSchema>,
  z.infer<typeof specificationParamSchema>
>({
  bodySchema: updateNeedsReferenceSchema,
  paramsSchema: specificationParamSchema,
  policy: requirementsMutationPolicy<
    z.infer<typeof updateNeedsReferenceSchema>,
    z.infer<typeof specificationParamSchema>
  >(({ body, params }) => ({
    kind: 'manage_specification_needs_reference',
    needsReferenceId: body.id,
    operation: 'update',
    specificationId: params.id,
  })),
  handler: async ({ body, context, db, params, request }) => {
    const { service } = await createRequirementsRestRuntime(request, {
      context,
      db,
    })
    const payload = await service.manageNeedsReference(context, {
      description: body.description ?? null,
      needsReferenceId: body.id,
      operation: 'update',
      specificationId: params.id,
      text: body.text,
    })
    if (!('needsReference' in payload)) {
      throw new Error('Needs-reference update returned an invalid outcome')
    }
    const { needsReference } = payload
    return NextResponse.json({ needsReference, ok: true })
  },
})

export const DELETE = secureMutationRoute<
  z.infer<typeof deleteNeedsReferenceSchema>,
  z.infer<typeof specificationParamSchema>
>({
  bodySchema: deleteNeedsReferenceSchema,
  paramsSchema: specificationParamSchema,
  policy: requirementsMutationPolicy<
    z.infer<typeof deleteNeedsReferenceSchema>,
    z.infer<typeof specificationParamSchema>
  >(({ body, params }) => ({
    kind: 'manage_specification_needs_reference',
    needsReferenceId: body.id,
    operation: 'delete',
    specificationId: params.id,
  })),
  handler: async ({ body, context, db, params, request }) => {
    const { service } = await createRequirementsRestRuntime(request, {
      context,
      db,
    })
    await service.manageNeedsReference(context, {
      needsReferenceId: body.id,
      operation: 'delete',
      specificationId: params.id,
    })
    return NextResponse.json({ ok: true })
  },
})
