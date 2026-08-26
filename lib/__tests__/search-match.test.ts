import { describe, expect, it } from 'vitest'
import {
  compareSearchMatches,
  findSearchMatch,
  normalizeSearchText,
} from '@/lib/requirements/search-match'

describe('search match helpers', () => {
  it('preserves Swedish search letters during normalization', () => {
    expect(
      normalizeSearchText('\u00c5  \u00c4  \u00d6  \u00e5  \u00e4  \u00f6'),
    ).toBe('\u00e5 \u00e4 \u00f6 \u00e5 \u00e4 \u00f6')
  })

  it('does not match Swedish letters as plain vowels', () => {
    expect(findSearchMatch({ name: 'M\u00e4ta' }, 'mata')).toBeNull()
    expect(findSearchMatch({ name: 'Cafe\u0301' }, 'cafe')).toMatchObject({
      matchedFields: ['name'],
      quality: 'normalizedExact',
    })
  })

  it('matches observable field values at each supported quality', () => {
    expect(
      findSearchMatch(
        {
          empty: ' ',
          exact: 'Secure API',
          missing: null,
          normalized: 'Cafe\u0301',
          partial: 'An encrypted secure API endpoint',
          prefix: 'Secure API endpoint',
        },
        'Secure API',
      ),
    ).toEqual({
      matchedFields: ['exact', 'partial', 'prefix'],
      quality: 'exact',
    })
    expect(findSearchMatch({ name: 'Cafe\u0301' }, 'CAFÉ')).toEqual({
      matchedFields: ['name'],
      quality: 'normalizedExact',
    })
    expect(findSearchMatch({ name: 'Secure API endpoint' }, 'secure')).toEqual({
      matchedFields: ['name'],
      quality: 'startsWith',
    })
    expect(findSearchMatch({ name: 'An encrypted endpoint' }, 'crypt')).toEqual(
      { matchedFields: ['name'], quality: 'contains' },
    )
  })

  it('rejects empty searches and fields with no match', () => {
    expect(findSearchMatch({ name: 'Requirement' }, '  ')).toBeNull()
    expect(findSearchMatch({ name: 'Requirement' }, 'unrelated')).toBeNull()
    expect(findSearchMatch({ numericId: 42 }, '42')).toEqual({
      matchedFields: ['numericId'],
      quality: 'exact',
    })
  })

  it('orders matches by search-match quality', () => {
    expect(
      compareSearchMatches(
        { matchedFields: ['name'], quality: 'exact' },
        { matchedFields: ['name'], quality: 'contains' },
      ),
    ).toBeLessThan(0)
    expect(
      compareSearchMatches(
        { matchedFields: ['name'], quality: 'startsWith' },
        { matchedFields: ['name'], quality: 'normalizedExact' },
      ),
    ).toBeGreaterThan(0)
  })
})
