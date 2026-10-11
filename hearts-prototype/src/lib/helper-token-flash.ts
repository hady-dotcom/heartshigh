/** The helper token is shown on the first Bring in response, then a reload must not show it again. */
export function helperTokenFlash(cookies: { once?: string | null; seen?: string | null }) {
  const once = String(cookies.once || '')
  const seen = cookies.seen === '1'
  if (once.startsWith('hlp_') && !seen) return { show: true, secret: once, setSeen: true, clear: false }
  if (seen || once) return { show: false, secret: '', setSeen: false, clear: true }
  return { show: false, secret: '', setSeen: false, clear: false }
}
