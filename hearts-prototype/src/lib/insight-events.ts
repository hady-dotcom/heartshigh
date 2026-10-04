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
