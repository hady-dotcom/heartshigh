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
  'learner',
  'learnerid',
  'learner_id',
  'deviceid',
  'device_id',
  'device',
] as const

export const INSIGHT_PERSON_KEYS = ['learner', 'learnerid', 'learner_id', 'deviceid', 'device_id', 'device'] as const

export function insightHoldsPerson(value: unknown, path = ''): string[] {
  const hits: string[] = []
  if (value == null) return hits
  if (typeof value === 'string') {
    if (/^learner:\d+/i.test(value) || /^device:/i.test(value)) hits.push(path || value)
    return hits
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => hits.push(...insightHoldsPerson(item, `${path}[${index}]`)))
    return hits
  }
  if (typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const next = path ? `${path}.${key}` : key
      if (INSIGHT_PERSON_KEYS.some((banned) => folded(key) === folded(banned))) hits.push(next)
      hits.push(...insightHoldsPerson(nested, next))
    }
  }
  return hits
}

/** Cookie if present, otherwise IP + user-agent. Never mint a fresh id to escape the bucket. */
export function insightBurstKey(input: { deviceId?: string | null; clientIp?: string | null; userAgent?: string | null }) {
  const cookie = String(input.deviceId || '')
  if (/^[a-zA-Z0-9_-]{8,80}$/.test(cookie)) return `cookie:${cookie}`
  const ip = String(input.clientIp || '').trim() || 'anon'
  const ua = String(input.userAgent || '').replace(/\s+/g, ' ').trim().slice(0, 80)
  return `ip:${ip}|ua:${ua}`
}

/** Outer per-IP key. Spoofed cookies or a changing UA cannot reset this bucket. */
export function insightIpBurstKey(clientIp?: string | null) {
  return `ip-only:${String(clientIp || '').trim() || 'anon'}`
}


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

export function insightEventRow(input: {
  kind: string
  route: string
  sessionId: string
  portalId?: number | null
  sampled: boolean
  props?: Record<string, unknown>
  x?: number
  y?: number
  vw?: number
  vh?: number
  depth?: number
  clipId?: string
  watchPct?: number
  step?: string
  interactive?: boolean
  at: string
  hideCoords?: boolean
}) {
  const props = sanitizeProps(input.props)
  const row = {
    kind: input.kind,
    route: input.route,
    sessionId: input.sessionId,
    subject: input.sessionId,
    portal: input.portalId || undefined,
    x: input.hideCoords || !Number.isFinite(Number(input.x)) ? undefined : Number(input.x),
    y: input.hideCoords || !Number.isFinite(Number(input.y)) ? undefined : Number(input.y),
    vw: input.hideCoords || !Number.isFinite(Number(input.vw)) ? undefined : Number(input.vw),
    vh: input.hideCoords || !Number.isFinite(Number(input.vh)) ? undefined : Number(input.vh),
    depth: Number.isFinite(Number(input.depth)) ? Number(input.depth) : undefined,
    clipId: input.clipId ? String(input.clipId).slice(0, 40) : undefined,
    watchPct: Number.isFinite(Number(input.watchPct)) ? Math.max(0, Math.min(100, Number(input.watchPct))) : undefined,
    step: input.step ? String(input.step).slice(0, 40) : undefined,
    interactive: Boolean(input.interactive),
    sampled: input.sampled,
    props,
    at: input.at,
  }
  const person = insightHoldsPerson(row)
  if (person.length) throw new Error(`Insights never store a person. Found ${person.join(', ')}.`)
  return row
}

export function sanitizeProps(props: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props || {})) {
    if (FORBIDDEN_PROP_KEYS.some((banned) => folded(key) === folded(banned))) continue
    if (typeof value === 'string') {
      // Coordinates and ids only: refuse long free text.
      if (value.length > 80) continue
      if (/@/.test(value)) continue
      if (/^learner:/i.test(value) || /^device:/i.test(value)) continue
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

/** Opening questions, placing, recalibrate, or the course player's question sheet. */
export function isAnswerScreen(path: string, extras?: { sheet?: boolean } | null) {
  const route = normaliseRoute(path)
  if (extras?.sheet && /\/course\//.test(route)) return true
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

export type ReplayEvent = { kind: string; route: string; watchPct?: number; depth?: number }

/** Collapse a tap dump into a short journey in words. */
export function replayLines(events: ReplayEvent[]) {
  const lines: { text: string; kind: string; route: string; n: number }[] = []
  for (const event of events) {
    const screen = routeWords(event.route)
    const last = lines[lines.length - 1]
    if (event.kind === 'tap' && last?.kind === 'tap' && last.route === event.route) {
      last.n += 1
      last.text = `tapped ${screen} · ${last.n} times`
      continue
    }
    const extra = event.watchPct != null
      ? ` · watched ${Math.round(event.watchPct)}%`
      : event.depth != null
        ? ` · scrolled ${Math.round(event.depth)}%`
        : ''
    lines.push({
      text: `${event.kind.replace(/_/g, ' ')} · ${screen}${extra}`,
      kind: event.kind,
      route: event.route,
      n: 1,
    })
  }
  return lines.slice(0, 16)
}

export function sessionReplayScore(events: { kind?: string; route?: string }[]) {
  const routes = new Set<string>()
  const kinds = new Set<string>()
  let score = 0
  for (const event of events) {
    if (event.route) routes.add(event.route)
    if (event.kind) kinds.add(event.kind)
    if (event.kind === 'route') score += 6
    else if (event.kind === 'clip_watch' || event.kind === 'clip_swipe') score += 4
    else if (event.kind === 'scroll' || event.kind === 'funnel') score += 2
    else score += 0.15
  }
  return score + routes.size * 12 + kinds.size * 4
}

export function tapPlace(x?: number | null, y?: number | null, vw = 390, vh = 844) {
  if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) return 'somewhere on the screen'
  const across = vw > 0 ? x / vw : 0.5
  const down = vh > 0 ? y / vh : 0.5
  const horiz = across < 0.33 ? 'left' : across > 0.66 ? 'right' : 'middle'
  const vert = down < 0.28 ? 'top' : down > 0.88 ? 'tab bar' : down > 0.72 ? 'lower' : 'middle'
  if (vert === 'tab bar') return `the tab bar, ${horiz}`
  return `the ${vert} ${horiz} of the screen`
}

export function angrySpotWords(input: { route?: string; x?: number | null; y?: number | null; vw?: number | null; vh?: number | null }) {
  const x = input.x
  const y = input.y
  const vw = Number(input.vw || 390)
  const vh = Number(input.vh || 844)
  const across = vw > 0 && x != null ? x / vw : 0.5
  const down = vh > 0 && y != null ? y / vh : 0.5
  const horiz = across < 0.33 ? 'left' : across > 0.66 ? 'right' : 'middle'
  const vert = down < 0.28 ? 'top' : down > 0.88 ? 'tab bar' : down > 0.72 ? 'lower' : 'middle'
  const place = vert === 'tab bar' ? `the tab bar (${horiz})` : `the ${vert} ${horiz}`
  return `${place} of ${routeWords(input.route || '/')}`
}

const buckets = new Map<string, { n: number; started: number }>()

function pruneInsightBursts(nowMs: number, windowMs: number) {
  for (const [id, held] of buckets) {
    if (nowMs - held.started > windowMs) buckets.delete(id)
  }
}

/** Simple in-process rate limit. 40 events / 10 s per key. */
export function allowInsightBurst(key: string, limit = 40, windowMs = 10_000, nowMs = Date.now()) {
  pruneInsightBursts(nowMs, windowMs)
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

export function allowInsightIngest(input: { deviceId?: string | null; clientIp?: string | null; userAgent?: string | null }, limit = 40, windowMs = 10_000, nowMs = Date.now()) {
  if (!allowInsightBurst(insightIpBurstKey(input.clientIp), limit, windowMs, nowMs)) return false
  return allowInsightBurst(insightBurstKey(input), limit, windowMs, nowMs)
}
