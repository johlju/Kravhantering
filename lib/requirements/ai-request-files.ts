import type { RequirementImportDestinationKind } from '@/lib/ai/requirement-prompt'

/**
 * Client-side names and URLs for the two files that let an external AI
 * assistant draft requirements: the AI request template and the reference
 * data file.
 */
export type AiRequestFile = 'referenceData' | 'template'

export type AiRequestFileDestination =
  | { kind: 'requirements_library' }
  | { kind: 'requirements_specification'; specificationId: number }

type Locale = 'en' | 'sv'

const FILE_NAME_PREFIX: Record<
  Locale,
  Record<AiRequestFile, Record<RequirementImportDestinationKind, string>>
> = {
  en: {
    referenceData: {
      requirements_library:
        'requirement-import-reference-data-requirements-library',
      requirements_specification:
        'requirement-import-reference-data-requirements-specification',
    },
    template: {
      requirements_library:
        'requirement-import-ai-request-template-requirements-library',
      requirements_specification:
        'requirement-import-ai-request-template-requirements-specification',
    },
  },
  sv: {
    referenceData: {
      requirements_library: 'kravimport-referensdata-kravbibliotek',
      requirements_specification: 'kravimport-referensdata-kravunderlag',
    },
    template: {
      requirements_library: 'kravimport-ai-anropsmall-kravbibliotek',
      requirements_specification: 'kravimport-ai-anropsmall-kravunderlag',
    },
  },
}

const FILE_PATHS: Record<AiRequestFile, string> = {
  referenceData: '/api/requirements/import/reference-data',
  template: '/api/requirements/import/ai-request-template',
}

export function aiRequestFileName(
  file: AiRequestFile,
  locale: Locale,
  destination: AiRequestFileDestination,
): string {
  const prefix = FILE_NAME_PREFIX[locale][file][destination.kind]
  if (file === 'template') return `${prefix}.md`
  return destination.kind === 'requirements_specification'
    ? `${prefix}-${destination.specificationId}.json`
    : `${prefix}.json`
}

export function aiRequestFileUrl(
  file: AiRequestFile,
  locale: Locale,
  destination: AiRequestFileDestination,
): string {
  const params = new URLSearchParams({ locale, kind: destination.kind })
  // The template depends only on the destination kind.
  if (
    file === 'referenceData' &&
    destination.kind === 'requirements_specification'
  ) {
    params.set('specificationId', String(destination.specificationId))
  }
  return `${FILE_PATHS[file]}?${params}`
}

/**
 * The destination of the AI request files for an import mode. Like the import
 * instruction, a requirements specification import needs the specification
 * id, so the files are unavailable (`null`) without it.
 */
export function resolveAiRequestFileDestination(
  mode: 'library' | 'specification-local',
  specificationId: number | null | undefined,
): AiRequestFileDestination | null {
  if (mode === 'library') return { kind: 'requirements_library' }
  return specificationId != null
    ? { kind: 'requirements_specification', specificationId }
    : null
}
