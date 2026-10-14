import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/** The only calls a helper token may make. */
export function helperTokenAllows(method: string, pathname: string) {
  if (pathname !== '/api/hearts/awaiting-transcript') return false
  return method === 'GET' || method === 'POST'
}

export function hashHelperToken(secret: string) {
  return createHash('sha256').update(secret).digest('hex')
}

export function newHelperToken() {
  const secret = `hlp_${randomBytes(24).toString('hex')}`
  return { secret, hash: hashHelperToken(secret), prefix: secret.slice(0, 12) }
}

export function helperTokenMatches(secret: string, hash: string) {
  const got = Buffer.from(hashHelperToken(secret))
  const want = Buffer.from(String(hash || ''), 'utf8')
  if (got.length !== want.length) return false
  return timingSafeEqual(got, want)
}

const hits = new Map<string, number[]>()

/** At most `limit` helper calls per token per window. */
export function helperRateOk(tokenId: number, limit = 30, windowMs = 60_000, now = Date.now()) {
  const key = String(tokenId)
  const recent = (hits.get(key) || []).filter((at) => now - at < windowMs)
  if (recent.length >= limit) {
    hits.set(key, recent)
    return false
  }
  recent.push(now)
  hits.set(key, recent)
  return true
}

export function resetHelperRates() {
  hits.clear()
}
