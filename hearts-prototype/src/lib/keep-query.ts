/** Keys the destination URL already set — do not overwrite with the page we are leaving. */
const DESTINATION_WINS = new Set(['part', 't', 'answer', 'clip', 'play', 'lane'])

function asSearch(incoming: string | URLSearchParams | Record<string, unknown> | null | undefined) {
  if (!incoming) return new URLSearchParams()
  if (incoming instanceof URLSearchParams) return incoming
  if (typeof incoming === 'string') return new URLSearchParams(incoming.startsWith('?') ? incoming.slice(1) : incoming)
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(incoming)) {
    if (value == null || value === false) continue
    const text = Array.isArray(value) ? String(value[0] ?? '') : String(value)
    if (text) params.set(key, text)
  }
  return params
}

/** Keep `?debug=yt` (and any other query) when moving between course and feed links. */
export function withCurrentQuery(href: string, incoming?: string | URLSearchParams | Record<string, unknown> | null) {
  const url = new URL(href, 'https://hearts.local')
  for (const [key, value] of asSearch(incoming).entries()) {
    if (DESTINATION_WINS.has(key) && url.searchParams.has(key)) continue
    if (!url.searchParams.has(key)) url.searchParams.set(key, value)
  }
  return `${url.pathname}${url.search}${url.hash}`
}
