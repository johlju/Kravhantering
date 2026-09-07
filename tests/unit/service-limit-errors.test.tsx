import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGeneratedOutputDownload } from '@/components/generated-output/useGeneratedOutputDownload'
import {
  GeneratedOutputError,
  generatedOutputErrorResponse,
} from '@/lib/generated-output/errors'
import { apiFetch } from '@/lib/http/api-fetch'
import {
  requestErrorLocale,
  serviceLimitMessage,
} from '@/lib/http/service-limit-message'
import en from '@/messages/en.json'
import sv from '@/messages/sv.json'

function Download() {
  const { download, dialog } = useGeneratedOutputDownload()
  return (
    <>
      <button
        onClick={() =>
          void download({
            url: '/api/requirements/export',
            output: 'csv',
            fallbackFilename: 'export.csv',
          })
        }
        type="button"
      >
        Export
      </button>
      {dialog}
    </>
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('safe service-limit messages', () => {
  it.each(['en', 'sv'] as const)(
    'bounds external details and handles all codes in %s',
    locale => {
      const messages = (locale === 'sv' ? sv : en).generatedOutput.limits
      for (const [value, seconds] of [
        [-2, 1],
        [900, 600],
        [3.5, 60],
        ['secret', 60],
      ] as const)
        expect(
          serviceLimitMessage(
            'actor_rate_limit',
            { retryAfterSeconds: value },
            locale,
          ),
        ).toBe(messages.actorRate.replace('{seconds}', String(seconds)))
      expect(serviceLimitMessage('actor_rate_limit', null, locale)).toBe(
        messages.actorRate.replace('{seconds}', '60'),
      )
      expect(
        serviceLimitMessage(
          'actor_concurrency_limit',
          { activeLimit: 50 },
          locale,
        ),
      ).toBe(messages.actorActiveMany.replace('{limit}', '10'))
      expect(
        serviceLimitMessage(
          'actor_concurrency_limit',
          { activeLimit: 0.5 },
          locale,
        ),
      ).toBe(messages.actorActive)
      expect(serviceLimitMessage('quota_check_unavailable', {}, locale)).toBe(
        messages.unavailable,
      )
      expect(serviceLimitMessage('capacity_busy', {}, locale)).toBe(
        messages.capacity,
      )
      expect(
        serviceLimitMessage('unknown_code', 'private diagnostics', locale),
      ).toBeUndefined()
    },
  )
  it.each([
    ['/sv/report', 'en', 'sv'],
    ['/en/report', 'sv', 'en'],
    ['/api/report?locale=sv', 'en', 'sv'],
    ['/api/report?locale=en', 'sv', 'en'],
    ['/api/report', 'SV-se,en', 'sv'],
    ['/api/report', '', 'en'],
  ])('selects the error language for %s and %s', (path, language, expected) => {
    expect(
      requestErrorLocale(
        new Request(`http://localhost${path}`, {
          headers: { 'Accept-Language': language },
        }),
      ),
    ).toBe(expected)
  })
})

describe.each([
  ['en', en],
  ['sv', sv],
] as const)('Localized admission errors: %s', (locale, messages) => {
  it.each([
    ['actor_rate_limit', 'actorRate'],
    ['actor_concurrency_limit', 'actorActive'],
    ['capacity_busy', 'capacity'],
    ['quota_check_unavailable', 'unavailable'],
    ['edge_rate_limit', 'edge'],
  ] as const)(
    'explains %s without displaying raw diagnostics',
    async (code, key) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          Response.json(
            {
              code,
              details: { output: 'csv', retryAfterSeconds: 12 },
              error: '<html>SQL secret another-person</html>',
            },
            {
              status: code === 'quota_check_unavailable' ? 503 : 429,
              headers: { 'Retry-After': '12' },
            },
          ),
        ),
      )
      render(
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Download />
        </NextIntlClientProvider>,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Export' }))
      const dialog = await screen.findByRole('alertdialog')
      expect(dialog).toHaveTextContent(
        messages.generatedOutput.limits[key].replace('{seconds}', '12'),
      )
      expect(dialog).not.toHaveTextContent('SQL secret')
    },
  )

  it('uses plural active-work wording at the configured limit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            code: 'actor_concurrency_limit',
            details: { output: 'csv', activeLimit: 2 },
          },
          { status: 429 },
        ),
      ),
    )
    render(
      <NextIntlClientProvider locale={locale} messages={messages}>
        <Download />
      </NextIntlClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      messages.generatedOutput.limits.actorActiveMany.replace('{limit}', '2'),
    )
  })

  it('renders readable no-store errors for a direct navigation', async () => {
    const request = new Request(
      `http://localhost/${locale}/requirements/reports/pdf/list`,
      { headers: { Accept: 'text/html' } },
    )
    const response = generatedOutputErrorResponse(
      new GeneratedOutputError(
        'actor_concurrency_limit',
        'actor_concurrency_limit',
        { output: 'pdf' },
      ),
      request,
    )
    expect(response.status).toBe(429)
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.text()).toContain(
      messages.generatedOutput.limits.actorActive,
    )
  })
})

it('normalizes an HTML edge rejection for ordinary API error handlers', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response('<h1>Internal proxy hostname</h1>', { status: 429 }),
    ),
  )
  const response = await apiFetch('/api/admin/archiving/exports', {
    method: 'POST',
  })
  expect(await response.json()).toMatchObject({
    code: 'edge_rate_limit',
    error: en.generatedOutput.limits.edge,
  })
})

it('uses a safe localized fallback for a non-JSON download rejection', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response('<html>private upstream</html>', { status: 429 }),
    ),
  )
  render(
    <NextIntlClientProvider locale="sv" messages={sv}>
      <Download />
    </NextIntlClientProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Export' }))
  await waitFor(() =>
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      sv.generatedOutput.limits.edge,
    ),
  )
})
