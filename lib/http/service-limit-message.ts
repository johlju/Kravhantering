import en from '@/messages/en.json'
import sv from '@/messages/sv.json'

export function serviceLimitMessage(
  code: unknown,
  details: unknown,
  locale: string,
): string | undefined {
  const messages = (locale === 'sv' ? sv : en).generatedOutput.limits
  const values =
    details && typeof details === 'object'
      ? (details as Record<string, unknown>)
      : {}
  const seconds =
    typeof values.retryAfterSeconds === 'number' &&
    Number.isInteger(values.retryAfterSeconds)
      ? Math.max(1, Math.min(600, values.retryAfterSeconds))
      : 60
  const limit =
    typeof values.activeLimit === 'number' &&
    Number.isInteger(values.activeLimit)
      ? Math.max(1, Math.min(10, values.activeLimit))
      : 1
  switch (code) {
    case 'actor_rate_limit':
      return messages.actorRate.replace('{seconds}', String(seconds))
    case 'actor_concurrency_limit':
      return (
        limit === 1 ? messages.actorActive : messages.actorActiveMany
      ).replace('{limit}', String(limit))
    case 'quota_check_unavailable':
      return messages.unavailable
    case 'capacity_busy':
      return messages.capacity
    case 'edge_rate_limit':
      return messages.edge
    default:
      return undefined
  }
}

export function requestErrorLocale(
  request: Pick<Request, 'url' | 'headers'>,
): 'en' | 'sv' {
  const url = new URL(request.url)
  if (
    url.pathname.startsWith('/sv/') ||
    url.searchParams.get('locale') === 'sv'
  )
    return 'sv'
  if (
    url.pathname.startsWith('/en/') ||
    url.searchParams.get('locale') === 'en'
  )
    return 'en'
  return request.headers.get('accept-language')?.toLowerCase().startsWith('sv')
    ? 'sv'
    : 'en'
}
