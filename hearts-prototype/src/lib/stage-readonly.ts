/** The demo stage looks at the real desks. A request from those frames must not save anything. */

export function stageEmbed(url: string, referer: string | null | undefined) {
  if (flag(url)) return true
  return Boolean(referer && flag(referer))
}

function flag(value: string) {
  try {
    return new URL(value, 'http://stage.local').searchParams.get('stage') === '1'
  } catch {
    return /[?&]stage=1(?:&|$)/.test(value)
  }
}

export function stageWriteBlocked(method: string, url: string, referer: string | null | undefined) {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false
  return stageEmbed(url, referer)
}

/** A full page load inside a stage frame keeps the flag. Script and data requests do not. */
export function stageFlagRedirect(input: { method: string; url: string; referer: string | null | undefined; dest: string | null | undefined }) {
  if (input.method !== 'GET' && input.method !== 'HEAD') return false
  if (input.dest !== 'document' && input.dest !== 'iframe') return false
  let path = input.url
  try {
    path = new URL(input.url, 'http://stage.local').pathname
  } catch {
    path = input.url.split('?')[0] || input.url
  }
  if (path.startsWith('/api') || path.startsWith('/demo-stage') || path.startsWith('/login') || path.startsWith('/_next')) return false
  if (flag(input.url)) return false
  return Boolean(input.referer && flag(input.referer))
}
