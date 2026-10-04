/**
 * Client insight events. Never store typed text, answers, Qur'an, or hadith.
 */

export const FORBIDDEN_PROP_KEYS = [
  'email',
  'name',
  'body',
  'answer',
  'text',
  'value',
  'transcript',
  'quran',
  'qur\'an',
  'hadith',
  'ayah',
  'prompt',
  'question',
  'message',
] as const

export const INSIGHT_KINDS = [
  'route',
  'tap',
  'angry_tap',
  'scroll',
  'clip_watch',
  'clip_swipe',
  'funnel',
] as const

export type InsightKind = (typeof INSIGHT_KINDS)[number]

export const DEFAULT_SAMPLE_RATE = 25

export function isInsightKind(value: string): value is InsightKind {
  return (INSIGHT_KINDS as readonly string[]).includes(value)
}

function folded(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function sanitizeProps(props: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props || {})) {
    if (FORBIDDEN_PROP_KEYS.some((banned) => folded(key) === folded(banned))) continue
    if (typeof value === 'string') {
      // Coordinates and ids only: refuse long free text.
      if (value.length > 80) continue
      if (/@/.test(value)) continue
      out[key] = value
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value
    }
  }
  return out
}

export function sampleSession(sessionId: string, rate = DEFAULT_SAMPLE_RATE) {
  const want = Math.max(0, Math.min(100, Math.round(Number(rate) || 0)))
  if (want >= 100) return true
  if (want <= 0) return false
  let hash = 2166136261
  for (let i = 0; i < sessionId.length; i++) {
    hash ^= sessionId.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash) % 100 < want
}

/** Angry taps and funnel steps are always kept; the rest follow the sample. */
export function shouldKeep(kind: string, sampled: boolean) {
  if (kind === 'angry_tap' || kind === 'funnel') return true
  return sampled
}

export function normaliseRoute(path: string) {
  const raw = String(path || '/').split('?')[0]
  return raw.replace(/\/p\/[^/]+/, '/p/:portal') || '/'
}

/** Opening questions, placing, recalibrate — a tap spot would reveal the answer. */
export function isAnswerScreen(path: string) {
  const route = normaliseRoute(path)
  return /\/(start|welcome|placing|recalibrate|opener)(\/|$)/.test(route) || /question/.test(route)
}

export function isPrivateLane(value?: string | null) {
  return String(value || '') === 'guarding-gaze'
}

export function routeWords(path: string) {
  const route = normaliseRoute(path)
  if (route.endsWith('/feed')) return 'the feed'
  if (route.endsWith('/start') || route.includes('/welcome')) return 'the opening questions'
  if (route.includes('/course/')) return 'a course'
  if (route.includes('/me/plan')) return 'the study plan'
  if (route.endsWith('/me')) return 'Me'
  if (route.includes('/mission')) return 'a mission'
  if (/\/p\/:portal\/?$/.test(route)) return 'Home'
  return 'this screen'
}

export function tapPlace(x?: number | null, y?: number | null, vw = 390, vh = 844) {
  if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) return 'somewhere on the screen'
  const across = vw > 0 ? x / vw : 0.5
  const down = vh > 0 ? y / vh : 0.5
  const horiz = across < 0.33 ? 'left' : across > 0.66 ? 'right' : 'middle'
  const vert = down < 0.28 ? 'top' : down > 0.72 ? 'lower third' : 'middle'
  if (vert === 'lower third' && down > 0.88) return `the tab bar, ${horiz}`
  return `the ${vert} ${horiz} of ${routeWords('') === 'this screen' ? 'the screen' : 'the screen'}`
}

export function angrySpotWords(input: { route?: string; x?: number | null; y?: number | null; vw?: number | null; vh?: number | null }) {
  const x = input.x
  const y = input.y
  const vw = Number(input.vw || 390)
  const vh = Number(input.vh || 844)
  const across = vw > 0 && x != null ? x / vw : 0.5
  const down = vh > 0 && y != null ? y / vh : 0.5
  const horiz = across < 0.33 ? 'left' : across > 0.66 ? 'right' : 'middle'
  const vert = down < 0.28 ? 'top' : down > 0.88 ? 'tab bar' : down > 0.72 ? 'lower third' : 'middle'
  const place = vert === 'tab bar' ? `the tab bar (${horiz})` : `the ${vert} ${horiz}`
  return `${place} of ${routeWords(input.route || '/')}`
}

const buckets = new Map<string, { n: number; started: number }>()

/** Simple in-process rate limit. 40 events / 10 s per session or device. */
export function allowInsightBurst(key: string, limit = 40, windowMs = 10_000, nowMs = Date.now()) {
  const id = String(key || 'anon').slice(0, 80)
  const held = buckets.get(id)
  if (!held || nowMs - held.started > windowMs) {
    buckets.set(id, { n: 1, started: nowMs })
    return true
  }
  held.n += 1
  return held.n <= limit
}

export function resetInsightBursts() {
  buckets.clear()
}
