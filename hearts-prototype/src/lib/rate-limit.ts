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
  // Cloudflare sets CF-Connecting-IP and overwrites any value the visitor sent.
  if (env.CF_CONNECTING_IP === '1' || env.TURNSTILE_SECRET_KEY) return 'cf-connecting-ip'
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

export const AUTH_WINDOW_MS = 10 * 60 * 1000
export const LOGIN_PER_IP = 20
export const LOGIN_PER_EMAIL = 10
export const JOIN_ATTEMPTS_PER_IP = 15
export const FORGOT_PER_IP = 5
export const FORGOT_PER_EMAIL = 3
export const RESET_PER_IP = 8
export const ANSWER_WINDOW_MS = 10 * 60 * 1000
export const ANSWER_PER_USER = 40
export const ANSWER_PER_IP = 80

/** The e2e suite signs in and answers many times from one address. Do not count those runs. */
export function limitsRelaxed(env: Record<string, string | undefined> = process.env) {
  return env.HEARTS_E2E === '1' || env.HEARTS_TEST_CLOCK === '1'
}

export type AuthKind = 'login' | 'join' | 'forgot' | 'reset'

function emailKey(email: string) {
  return email.trim().toLowerCase().slice(0, 120)
}

export function authKeys(kind: AuthKind, ip: string | null, email?: string | null) {
  const address = ip ? `${kind}:${ip}` : null
  const person = email ? `${kind}-email:${emailKey(email)}` : null
  return { address, person }
}

export function authLimit(kind: AuthKind) {
  if (kind === 'login') return { ip: LOGIN_PER_IP, email: LOGIN_PER_EMAIL }
  if (kind === 'join') return { ip: JOIN_ATTEMPTS_PER_IP, email: JOIN_ATTEMPTS_PER_IP }
  if (kind === 'forgot') return { ip: FORGOT_PER_IP, email: FORGOT_PER_EMAIL }
  return { ip: RESET_PER_IP, email: RESET_PER_IP }
}

/** Counts one auth try. Relaxed in the e2e and test-clock servers. */
export function hitAuth(kind: AuthKind, ip: string | null, email?: string | null, env: Record<string, string | undefined> = process.env, at = Date.now()) {
  if (limitsRelaxed(env)) return { allowed: true, retryAfterSec: 0, count: 0 }
  const keys = authKeys(kind, ip, email)
  const cap = authLimit(kind)
  if (keys.address) {
    const address = hit(keys.address, cap.ip, AUTH_WINDOW_MS, at)
    if (!address.allowed) return address
  }
  if (keys.person) {
    const person = hit(keys.person, cap.email, AUTH_WINDOW_MS, at)
    if (!person.allowed) return person
  }
  return { allowed: true, retryAfterSec: 0, count: 0 }
}

export function answerKeys(userId: number | null, ip: string | null) {
  return { person: userId ? `answer-user:${userId}` : null, address: ip ? `answer-ip:${ip}` : null }
}

export function hitAnswer(userId: number | null, ip: string | null, env: Record<string, string | undefined> = process.env, at = Date.now()) {
  if (limitsRelaxed(env)) return { allowed: true, retryAfterSec: 0, count: 0 }
  const keys = answerKeys(userId, ip)
  if (keys.person) {
    const person = hit(keys.person, ANSWER_PER_USER, ANSWER_WINDOW_MS, at)
    if (!person.allowed) return person
  }
  if (keys.address) {
    const address = hit(keys.address, ANSWER_PER_IP, ANSWER_WINDOW_MS, at)
    if (!address.allowed) return address
  }
  return { allowed: true, retryAfterSec: 0, count: 0 }
}
