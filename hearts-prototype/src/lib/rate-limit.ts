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

export function clientIp(req: Request) {
  return req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
}
