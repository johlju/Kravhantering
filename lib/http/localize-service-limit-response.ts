import { serviceLimitMessage } from '@/lib/http/service-limit-message'

/** Normalize a throttled API response without exposing an ingress HTML body. */
export async function localizeServiceLimitResponse(
  response: Response,
  locale: string,
): Promise<Response> {
  let body: Record<string, unknown> = {}
  try {
    body = await response.clone().json()
  } catch {
    // Ingress responses may not contain JSON.
  }
  const code =
    typeof body?.code === 'string'
      ? body.code
      : response.status === 429
        ? 'edge_rate_limit'
        : undefined
  const message = serviceLimitMessage(code, body?.details, locale)
  if (!message) return response

  const headers = new Headers(response.headers)
  headers.delete('Content-Length')
  headers.set('Content-Type', 'application/json')
  return Response.json(
    { code, details: body?.details, error: message },
    { status: response.status, headers },
  )
}
