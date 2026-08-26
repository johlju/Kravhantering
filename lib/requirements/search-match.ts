export type SearchMatchQuality =
  | 'contains'
  | 'exact'
  | 'normalizedExact'
  | 'startsWith'

export interface SearchMatch {
  matchedFields: string[]
  quality: SearchMatchQuality
}

const QUALITY_RANK: Record<SearchMatchQuality, number> = {
  exact: 0,
  normalizedExact: 1,
  startsWith: 2,
  contains: 3,
}

const SWEDISH_SEARCH_LETTER_SENTINELS: Record<string, string> = {
  '\u00c4': '\uE001',
  '\u00c5': '\uE002',
  '\u00d6': '\uE003',
  '\u00e4': '\uE004',
  '\u00e5': '\uE005',
  '\u00f6': '\uE006',
}

const SWEDISH_SEARCH_SENTINEL_LETTERS = new Map(
  Object.entries(SWEDISH_SEARCH_LETTER_SENTINELS).map(([letter, sentinel]) => [
    sentinel,
    letter,
  ]),
)

function preserveSwedishSearchLetters(value: string): string {
  return value.replace(
    /[\u00c4\u00c5\u00d6\u00e4\u00e5\u00f6]/g,
    letter => SWEDISH_SEARCH_LETTER_SENTINELS[letter] ?? letter,
  )
}

function restoreSwedishSearchLetters(value: string): string {
  return value.replace(/[\uE001-\uE006]/g, sentinel => {
    return SWEDISH_SEARCH_SENTINEL_LETTERS.get(sentinel) ?? sentinel
  })
}

export function normalizeSearchText(value: string): string {
  const withoutNonSwedishDiacritics = preserveSwedishSearchLetters(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  return restoreSwedishSearchLetters(withoutNonSwedishDiacritics)
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('sv')
}

function fieldMatchQuality(
  rawFieldValue: unknown,
  rawSearch: string,
  normalizedSearch: string,
): SearchMatchQuality | null {
  if (rawFieldValue == null) return null
  const fieldValue = String(rawFieldValue).trim()
  if (!fieldValue) return null
  if (fieldValue === rawSearch.trim()) return 'exact'

  const normalizedField = normalizeSearchText(fieldValue)
  if (!normalizedField || !normalizedSearch) return null
  if (normalizedField === normalizedSearch) return 'normalizedExact'
  if (normalizedField.startsWith(normalizedSearch)) return 'startsWith'
  if (normalizedField.includes(normalizedSearch)) return 'contains'
  return null
}

export function findSearchMatch(
  fields: Record<string, unknown>,
  search: string,
): SearchMatch | null {
  const normalizedSearch = normalizeSearchText(search)
  if (!normalizedSearch) return null

  let quality: SearchMatchQuality | null = null
  const matchedFields: string[] = []
  for (const [fieldName, fieldValue] of Object.entries(fields)) {
    const fieldQuality = fieldMatchQuality(fieldValue, search, normalizedSearch)
    if (!fieldQuality) continue
    matchedFields.push(fieldName)
    if (quality == null || QUALITY_RANK[fieldQuality] < QUALITY_RANK[quality]) {
      quality = fieldQuality
    }
  }

  return quality ? { quality, matchedFields } : null
}

export function compareSearchMatches(
  left: SearchMatch,
  right: SearchMatch,
): number {
  return QUALITY_RANK[left.quality] - QUALITY_RANK[right.quality]
}
