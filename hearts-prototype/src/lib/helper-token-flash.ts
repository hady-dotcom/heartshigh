/** Read one cookie from the Cookie header the browser sent. A cookie set on this same response is not in that header. */
export function cookieValue(header: string | null | undefined, name: string) {
  const parts = String(header || '').split(';')
  for (const part of parts) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    if (trimmed.slice(0, eq) !== name) continue
    try {
      return decodeURIComponent(trimmed.slice(eq + 1))
    } catch {
      return trimmed.slice(eq + 1)
    }
  }
  return ''
}

/** The helper token is shown on the first Bring in response, then a reload must not show it again. */
export function helperTokenFlash(cookies: { once?: string | null; seen?: string | null }) {
  const once = String(cookies.once || '')
  const seen = cookies.seen === '1'
  if (once.startsWith('hlp_') && !seen) return { show: true, secret: once, setSeen: true, clear: false }
  if (seen || once) return { show: false, secret: '', setSeen: false, clear: true }
  return { show: false, secret: '', setSeen: false, clear: false }
}
