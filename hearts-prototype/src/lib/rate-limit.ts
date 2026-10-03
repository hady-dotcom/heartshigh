// A small in-memory limiter: one process, sliding window. Enough for a single-server prototype; a shared store
// (Redis or the database) is needed once there is more than one server.
type Store = Map<string, number[]>
const holder = globalThis as typeof globalThis & { __heartsLimits?: Store }
const store = (): Store => (holder.__heartsLimits ??= new Map())

export type LimitResult = { allowed: boolean; retryAfterSec: number; count: number }

/** Counts one attempt against `key` and says whether it is within `limit` attempts per `windowMs`. */
export function hit(key: string, limit: number, windowMs: number, at = Date.now()): LimitResult {
  const recent = (store().get(key) || []).filter((stamp) => stamp > at - windowMs && stamp <= at)
  if (recent.length >= limit) {
    store().set(key, recent)
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((recent[0] + windowMs - at) / 1000)), count: recent.length }
  }
  recent.push(at)
  store().set(key, recent)
  return { allowed: true, retryAfterSec: 0, count: recent.length }
}

/** Looks without counting. */
export function peek(key: string, limit: number, windowMs: number, at = Date.now()) {
  const recent = (store().get(key) || []).filter((stamp) => stamp > at - windowMs && stamp <= at)
  return { allowed: recent.length < limit, count: recent.length }
}

export function resetLimits() {
  store().clear()
}

const IP = /^[0-9a-f.:]{2,45}$/i

/**
 * A header the platform itself sets, and overwrites, with the real client address.
 * X-Forwarded-For is never accepted here: the visitor can put anything at the left of that list.
 * Fly sets Fly-Client-IP and strips any value the visitor sent, so it is used when FLY_APP_NAME is present.
 */
export function platformClientIpHeader(env: Record<string, string | undefined> = process.env) {
  const named = (env.HEARTS_CLIENT_IP_HEADER || '').trim().toLowerCase()
  if (named) {
    if (named === 'x-forwarded-for' || named === 'forwarded' || named === 'x-real-ip') return null
    return named
  }
  if (env.FLY_APP_NAME) return 'fly-client-ip'
  return null
}

/**
 * How many proxies of ours sit in front of the app, from HEARTS_TRUSTED_PROXY_HOPS. 0 means none is trusted.
 * When the variable is unset, Railway and Render count as one hop, because their edge appends the address it saw.
 * An explicit 0 is respected, including on those hosts.
 */
export function trustedProxyHops(env: Record<string, string | undefined> = process.env) {
  const raw = env.HEARTS_TRUSTED_PROXY_HOPS
  if (raw != null && raw !== '') {
    const hops = Number(raw)
    return Number.isInteger(hops) && hops > 0 && hops < 10 ? hops : 0
  }
  if (env.RAILWAY_PROJECT_ID || env.RAILWAY_ENVIRONMENT || env.RAILWAY_ENVIRONMENT_NAME || env.RAILWAY_SERVICE_ID) return 1
  if (env.RENDER || env.RENDER_SERVICE_ID) return 1
  return 0
}

/**
 * The visitor's address, or null when it cannot be known.
 * A configured platform header is used on its own. Otherwise X-Forwarded-For is read only behind a configured
 * trusted proxy, and then from the right: each proxy appends the address it was reached from, so the entry our
 * outermost proxy wrote is the last `hops` from the end. Anything to its left was sent by the visitor and can say anything.
 */
export function clientIp(req: Request, hops = trustedProxyHops(), env: Record<string, string | undefined> = process.env) {
  const header = platformClientIpHeader(env)
  if (header) {
    const value = (req.headers.get(header) || '').trim()
    return IP.test(value) ? value : null
  }
  if (!hops) return null
  const chain = (req.headers.get('x-forwarded-for') || '').split(',').map((part) => part.trim()).filter(Boolean)
  const seen = chain[chain.length - hops]
  return seen && IP.test(seen) ? seen : null
}

/**
 * Keys for counting failed join attempts. Always the address (or "unknown") with the code that was tried, so one
 * person retrying a typo is slowed; and the address alone only when it is trustworthy, so a guesser is stopped
 * without strangers sharing a key and blocking each other.
 */
export function joinFailKeys(ip: string | null, code: string) {
  return { pair: `join-fail:${ip || 'unknown'}:${code}`, address: ip ? `join-fail:${ip}` : null }
}
