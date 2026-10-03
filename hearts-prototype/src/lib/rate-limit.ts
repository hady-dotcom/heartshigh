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

/** How many proxies of ours sit in front of the app, from HEARTS_TRUSTED_PROXY_HOPS. 0 means none is trusted. */
export function trustedProxyHops(env: Record<string, string | undefined> = process.env) {
  const hops = Number(env.HEARTS_TRUSTED_PROXY_HOPS || 0)
  return Number.isInteger(hops) && hops > 0 && hops < 10 ? hops : 0
}

/**
 * The visitor's address as our own proxy saw it, or null when it cannot be known. X-Forwarded-For is only read behind
 * a configured trusted proxy, and then from the right: each proxy appends the address it was reached from, so the
 * entry our outermost proxy wrote is the last `hops` from the end. Anything to its left was sent by the visitor and
 * can say anything.
 */
export function clientIp(req: Request, hops = trustedProxyHops()) {
  if (!hops) return null
  const chain = (req.headers.get('x-forwarded-for') || '').split(',').map((part) => part.trim()).filter(Boolean)
  const seen = chain[chain.length - hops]
  return seen && /^[0-9a-f.:]{2,45}$/i.test(seen) ? seen : null
}

/**
 * Keys for counting failed join attempts. Always the address (or "unknown") with the code that was tried, so one
 * person retrying a typo is slowed; and the address alone only when it is trustworthy, so a guesser is stopped
 * without strangers sharing a key and blocking each other.
 */
export function joinFailKeys(ip: string | null, code: string) {
  return { pair: `join-fail:${ip || 'unknown'}:${code}`, address: ip ? `join-fail:${ip}` : null }
}
