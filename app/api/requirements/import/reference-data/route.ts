import { NextResponse } from 'next/server'
import { withRestResponsePolicy } from '@/lib/http/response-policy'
import { unauthorizedError, validationError } from '@/lib/requirements/errors'
import { toHttpErrorPayload } from '@/lib/requirements/http-errors'
import {
  importDestinationFromQuery,
  importLocaleFromQuery,
} from '@/lib/requirements/import-destination-query'
import { serializeRequirementImportReferenceDataFile } from '@/lib/requirements/import-reference-data-file'
import { createRequirementsRestRuntime } from '@/lib/requirements/server'

const MISSING_REFERENCE_DATA_DESTINATION_MESSAGE =
  'Reference data destination is required. Use kind=requirements_library.'

const UNSUPPORTED_REFERENCE_DATA_DESTINATION_MESSAGE =
  'Reference data files are available for requirements_library destinations.'

async function getHandler(request: Request) {
  try {
    const { context, service } = await createRequirementsRestRuntime(request)
    if (!context.actor.isAuthenticated) {
      throw unauthorizedError()
    }
    const searchParams = new URL(request.url).searchParams
    const destination = importDestinationFromQuery(
      searchParams,
      MISSING_REFERENCE_DATA_DESTINATION_MESSAGE,
    )
    if (destination.kind !== 'requirements_library') {
      throw validationError(UNSUPPORTED_REFERENCE_DATA_DESTINATION_MESSAGE, {
        reason: 'unsupported_import_reference_data_destination',
      })
    }
    const referenceDataFile = await service.getImportReferenceDataFile(
      context,
      {
        destination,
        locale: importLocaleFromQuery(searchParams),
      },
    )
    return new NextResponse(
      serializeRequirementImportReferenceDataFile(referenceDataFile),
      {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
      },
    )
  } catch (error) {
    const { body, status } = toHttpErrorPayload(error)
    return NextResponse.json(body, { status })
  }
}

export const GET = withRestResponsePolicy(getHandler)
