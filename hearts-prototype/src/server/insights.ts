import type { Payload, Where } from 'payload'
import { now } from '@/lib/clock'
import { isProduction, isRemoteDatabase } from '@/lib/env'
import { FUNNEL_STEPS, funnelMaths, retentionByDay, type FunnelResult } from '@/lib/insight-funnel'
import { heatmapGrid, type HeatCell } from '@/lib/insight-taps'
import { allowInsightBurst, angrySpotWords, DEFAULT_SAMPLE_RATE, isAnswerScreen, isInsightKind, isPrivateLane, normaliseRoute, sampleSession, sanitizeProps, shouldKeep } from '@/lib/insight-events'
import { idOf, portalIdOf } from '@/lib/ids'
import { audit } from './viewas'
import type { SessionUser } from './context'

const col = (name: string) => name as 'users'

export type InsightActor = { id: number; role: SessionUser['role']; tenants?: { tenant?: unknown }[] }

export function canViewInsights(actor: InsightActor | null | undefined) {
  return actor?.role === 'master' || actor?.role === 'portal-admin'
}

function assertView(actor: InsightActor) {
  if (!canViewInsights(actor)) throw new Error('Insights are for the master desk and portal admins.')
}

export type IncomingEvent = {
  kind: string
  route?: string
  sessionId: string
  x?: number
  y?: number
  vw?: number
  vh?: number
  depth?: number
  clipId?: string
  watchPct?: number
  step?: string
  interactive?: boolean
  props?: Record<string, unknown>
  at?: string
}

type Flags = { insightSampleRate?: number | null }

async function sampleRateOf(payload: Payload) {
  const flags = (await payload.findGlobal({ slug: 'master-flags', overrideAccess: true }).catch(() => null)) as Flags | null
  const rate = Number(flags?.insightSampleRate)
  return Number.isFinite(rate) ? rate : DEFAULT_SAMPLE_RATE
}

export async function ingestEvents(
  payload: Payload,
  input: {
    user?: SessionUser | null
    deviceId?: string | null
    portalId?: number | null
    events: IncomingEvent[]
  },
) {
  const subject = input.user?.role === 'learner' ? `learner:${input.user.id}` : input.deviceId ? `device:${input.deviceId}` : ''
  const optedIn = Boolean(input.user && 'trendsOptIn' in input.user && input.user.trendsOptIn)
  const rate = await sampleRateOf(payload)
  const burstKey = String(input.events[0]?.sessionId || input.deviceId || input.user?.id || 'anon')
  if (!allowInsightBurst(burstKey, 40, 10_000)) return { stored: 0, limited: true }
  let stored = 0
  const stamp = now()
  for (const [index, raw] of input.events.slice(0, 20).entries()) {
    if (!isInsightKind(raw.kind)) continue
    const sessionId = String(raw.sessionId || '').slice(0, 48)
    if (!sessionId) continue
    const sampled = sampleSession(sessionId, rate)
    if (!shouldKeep(raw.kind, sampled)) continue
    const route = normaliseRoute(raw.route || '/')
    if (isPrivateLane(String((raw.props as { lane?: string } | undefined)?.lane || ''))) continue
    const hideCoords = isAnswerScreen(route) || !optedIn || raw.kind === 'tap' && isAnswerScreen(route)
    const at = new Date(stamp.getTime() + index).toISOString()
    try {
      await payload.create({
        collection: col('insight-events'),
        overrideAccess: true,
        data: {
          kind: raw.kind,
          route,
          sessionId,
          subject: hideCoords && raw.kind !== 'funnel' ? sessionId : (subject || sessionId),
          learner: hideCoords || input.user?.role !== 'learner' ? undefined : input.user.id,
          deviceId: input.deviceId || undefined,
          portal: input.portalId || undefined,
          x: hideCoords || !Number.isFinite(Number(raw.x)) ? undefined : Number(raw.x),
          y: hideCoords || !Number.isFinite(Number(raw.y)) ? undefined : Number(raw.y),
          vw: hideCoords || !Number.isFinite(Number(raw.vw)) ? undefined : Number(raw.vw),
          vh: hideCoords || !Number.isFinite(Number(raw.vh)) ? undefined : Number(raw.vh),
          depth: Number.isFinite(Number(raw.depth)) ? Number(raw.depth) : undefined,
          clipId: raw.clipId ? String(raw.clipId).slice(0, 40) : undefined,
          watchPct: Number.isFinite(Number(raw.watchPct)) ? Math.max(0, Math.min(100, Number(raw.watchPct))) : undefined,
          step: raw.step ? String(raw.step).slice(0, 40) : undefined,
          interactive: Boolean(raw.interactive),
          sampled,
          props: sanitizeProps(raw.props),
          at,
        } as never,
      })
      stored += 1
      if (raw.kind === 'route') {
        await touchSession(payload, {
          sessionId,
          subject: subject || sessionId,
          learnerId: input.user?.role === 'learner' ? input.user.id : undefined,
          deviceId: input.deviceId,
          portalId: input.portalId,
          sampled,
          route,
          at,
        })
      }
    } catch {
      // A tracking miss must never break a tap.
    }
  }
  return { stored }
}

async function touchSession(payload: Payload, input: {
  sessionId: string
  subject: string
  learnerId?: number
  deviceId?: string | null
  portalId?: number | null
  sampled: boolean
  route: string
  at: string
}) {
  const found = await payload.find({
    collection: col('insight-sessions'),
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { sessionId: { equals: input.sessionId } },
  })
  const row = found.docs[0] as { id: number; routes?: string[] } | undefined
  const routes = [...new Set([...(row?.routes || []), input.route])].slice(0, 40)
  if (row) {
    await payload.update({
      collection: col('insight-sessions'),
      id: row.id,
      overrideAccess: true,
      data: { endedAt: input.at, routes } as never,
    })
    return
  }
  await payload.create({
    collection: col('insight-sessions'),
    overrideAccess: true,
    data: {
      sessionId: input.sessionId,
      subject: input.subject,
      learner: input.learnerId,
      deviceId: input.deviceId || undefined,
      portal: input.portalId || undefined,
      sampled: input.sampled,
      startedAt: input.at,
      endedAt: input.at,
      routes,
    } as never,
  })
}

export async function recordFunnel(payload: Payload, input: {
  user?: SessionUser | null
  deviceId?: string | null
  portalId?: number | null
  sessionId?: string
  step: string
  route?: string
}) {
  if (!FUNNEL_STEPS.some((row) => row.key === input.step)) return
  await ingestEvents(payload, {
    user: input.user,
    deviceId: input.deviceId,
    portalId: input.portalId,
    events: [{
      kind: 'funnel',
      sessionId: input.sessionId || `funnel-${input.user?.id || input.deviceId || 'anon'}`,
      step: input.step,
      route: input.route || '/',
    }],
  })
}

function portalWhere(actor: InsightActor): Where | undefined {
  if (actor.role === 'master') return undefined
  const portal = portalIdOf(actor)
  if (!portal) return { id: { equals: 0 } }
  return { portal: { equals: portal } }
}

type EventRow = {
  id: number
  kind?: string
  route?: string
  sessionId?: string
  subject?: string
  x?: number | null
  y?: number | null
  vw?: number | null
  vh?: number | null
  depth?: number | null
  clipId?: string | null
  watchPct?: number | null
  step?: string | null
  interactive?: boolean | null
  at?: string
}

async function loadEvents(payload: Payload, actor: InsightActor, extra?: Where, limit = 4000) {
  const where = extra && portalWhere(actor)
    ? { and: [portalWhere(actor)!, extra] }
    : extra || portalWhere(actor)
  const found = await payload.find({
    collection: col('insight-events'),
    overrideAccess: true,
    depth: 0,
    limit,
    pagination: false,
    sort: '-at',
    where,
  })
  return found.docs as unknown as EventRow[]
}

export type InsightsDesk = {
  routes: { route: string; taps: number; angry: number; sessions: number }[]
  heatmap: { route: string; cells: HeatCell[]; max: number; taps: number }
  funnel: FunnelResult
  angry: { id: number; route: string; x: number; y: number; at: string; sessionId: string; place: string }[]
  retention: { cohort: number; points: { day: number; returned: number; rate: number }[] }
  watch: { clips: number; medianPct: number; swipeAway: number }
  scroll: { route: string; max: number }[]
  replay: { sessionId: string; events: { kind: string; route: string; x?: number; y?: number; at?: string; watchPct?: number; depth?: number }[] } | null
  sampleRate: number
  testData: boolean
}

export async function insightsDesk(payload: Payload, actor: InsightActor, query: { route?: string; session?: string } = {}): Promise<InsightsDesk> {
  assertView(actor)
  const events = await loadEvents(payload, actor)
  const byRoute = new Map<string, { taps: number; angry: number; sessions: Set<string> }>()
  for (const row of events) {
    const route = row.route || '/'
    if (!byRoute.has(route)) byRoute.set(route, { taps: 0, angry: 0, sessions: new Set() })
    const held = byRoute.get(route)!
    if (row.sessionId) held.sessions.add(row.sessionId)
    if (row.kind === 'tap') held.taps += 1
    if (row.kind === 'angry_tap') held.angry += 1
  }
  const routes = [...byRoute.entries()]
    .map(([route, row]) => ({ route, taps: row.taps, angry: row.angry, sessions: row.sessions.size }))
    .sort((a, b) => b.taps + b.angry * 3 - (a.taps + a.angry * 3))
  const route = query.route && byRoute.has(query.route) ? query.route : routes[0]?.route || '/p/:portal/feed'
  const taps = events.filter((row) => row.route === route && (row.kind === 'tap' || row.kind === 'angry_tap') && row.x != null && row.y != null)
  const cells = heatmapGrid(taps.map((row) => ({ x: Number(row.x), y: Number(row.y), vw: Number(row.vw || 390), vh: Number(row.vh || 844) })))
  const funnel = funnelMaths(events.filter((row) => row.kind === 'funnel').map((row) => ({ sessionId: String(row.sessionId || ''), step: String(row.step || '') })))
  const angry = events
    .filter((row) => row.kind === 'angry_tap')
    .slice(0, 40)
    .map((row) => ({
      id: row.id,
      route: row.route || '/',
      x: Number(row.x || 0),
      y: Number(row.y || 0),
      at: String(row.at || ''),
      sessionId: String(row.sessionId || ''),
      place: angrySpotWords({ route: row.route, x: row.x, y: row.y, vw: row.vw, vh: row.vh }),
    }))
  const scrollByRoute = new Map<string, number>()
  for (const row of events) {
    if (row.kind !== 'scroll' || row.depth == null) continue
    const route = row.route || '/'
    scrollByRoute.set(route, Math.max(scrollByRoute.get(route) || 0, Number(row.depth) || 0))
  }
  const firstSeen: Record<string, string> = {}
  const visits: { subject: string; day: string }[] = []
  for (const row of events) {
    const subject = String(row.subject || row.sessionId || '')
    const day = String(row.at || '').slice(0, 10)
    if (!subject || !day) continue
    visits.push({ subject, day })
    if (!firstSeen[subject] || day < firstSeen[subject]) firstSeen[subject] = day
  }
  const watchRows = events.filter((row) => row.kind === 'clip_watch' && row.watchPct != null)
  const pcts = watchRows.map((row) => Number(row.watchPct)).sort((a, b) => a - b)
  const swipeAway = events.filter((row) => row.kind === 'clip_swipe').length
  const sessionWeight = new Map<string, number>()
  for (const row of events) {
    if (!row.sessionId) continue
    sessionWeight.set(row.sessionId, (sessionWeight.get(row.sessionId) || 0) + (row.kind === 'route' ? 2 : 1))
  }
  const richest = [...sessionWeight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || ''
  const replayId = query.session || richest || events.find((row) => row.kind === 'route')?.sessionId || ''
  const replayEvents = replayId
    ? events
      .filter((row) => row.sessionId === replayId && (row.kind === 'route' || row.kind === 'tap' || row.kind === 'angry_tap' || row.kind === 'clip_watch' || row.kind === 'clip_swipe' || row.kind === 'scroll'))
      .sort((a, b) => String(a.at).localeCompare(String(b.at)))
      .slice(0, 80)
      .map((row) => ({
        kind: String(row.kind),
        route: String(row.route),
        x: row.x ?? undefined,
        y: row.y ?? undefined,
        at: row.at,
        watchPct: row.watchPct ?? undefined,
        depth: row.depth ?? undefined,
      }))
    : []
  return {
    routes,
    heatmap: { route, cells, max: Math.max(1, ...cells.map((cell) => cell.n)), taps: taps.length },
    funnel,
    angry,
    retention: retentionByDay(firstSeen, visits),
    watch: {
      clips: watchRows.length,
      medianPct: pcts.length ? pcts[Math.floor(pcts.length / 2)] : 0,
      swipeAway,
    },
    replay: replayId ? { sessionId: replayId, events: replayEvents } : null,
    sampleRate: await sampleRateOf(payload),
    scroll: [...scrollByRoute.entries()].map(([route, max]) => ({ route, max })).sort((a, b) => b.max - a.max),
    testData: events.some((row) => String(row.subject || '').startsWith('test-data:')),
  }
}

export async function fillInsightDemo(payload: Payload, actor: InsightActor) {
  if (actor.role !== 'master') throw new Error('Only the master can add labelled test numbers.')
  if (isProduction() || isRemoteDatabase()) throw new Error('Test numbers stay on a local or development database.')
  const existing = await payload.find({
    collection: col('insight-events'),
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { subject: { like: 'test-data:' } },
  })
  if (existing.docs.length) throw new Error('Labelled test numbers are already on Insights.')
  const stamp = now()
  const routes = ['/p/:portal/feed', '/p/:portal', '/p/:portal/start', '/p/:portal/course/1', '/p/:portal/me/plan']
  const jobs: Promise<unknown>[] = []
  let n = 0
  const push = (data: Record<string, unknown>) => {
    n += 1
    jobs.push(payload.create({ collection: col('insight-events'), overrideAccess: true, data: data as never }))
  }
  for (let s = 0; s < 24; s++) {
    const sessionId = `test-sess-${s}`
    const subject = `test-data:${s}`
    const day = new Date(stamp.getTime() - (s % 8) * 86_400_000).toISOString()
    push({ kind: 'route', route: routes[s % 3], sessionId, subject, sampled: true, at: day, props: { test: true } })
    push({ kind: 'funnel', route: '/p/:portal/start', sessionId, subject, step: 'opening_questions', sampled: true, at: day })
    if (s < 18) push({ kind: 'funnel', route: '/p/:portal/feed', sessionId, subject, step: 'first_clip', sampled: true, at: day })
    if (s < 10) push({ kind: 'funnel', route: '/p/:portal/course/1', sessionId, subject, step: 'course_start', sampled: true, at: day })
    if (s < 6) push({ kind: 'funnel', route: '/p/:portal/me/plan', sessionId, subject, step: 'study_plan_saved', sampled: true, at: day })
    const spots = [
      { x: 196, y: 718, n: 8 },
      { x: 340, y: 390, n: 4 },
      { x: 196, y: 410, n: 5 },
      { x: 52, y: 86, n: 2 },
      { x: 78, y: 800, n: 2 },
      { x: 196, y: 800, n: 3 },
    ]
    for (const spot of spots) {
      for (let t = 0; t < spot.n; t++) {
        push({
          kind: 'tap',
          route: '/p/:portal/feed',
          sessionId,
          subject,
          x: spot.x + ((s * 7 + t * 11) % 21) - 10,
          y: spot.y + ((s * 5 + t * 9) % 17) - 8,
          vw: 390,
          vh: 844,
          interactive: spot.y > 680,
          sampled: true,
          at: day,
        })
      }
    }
    push({ kind: 'scroll', route: '/p/:portal/feed', sessionId, subject, depth: 55 + (s * 7) % 40, sampled: true, at: day })
    if (s % 3 === 0) {
      push({ kind: 'route', route: '/p/:portal/feed', sessionId, subject, sampled: true, at: day })
      push({ kind: 'tap', route: '/p/:portal/feed', sessionId, subject, x: 196, y: 718, vw: 390, vh: 844, sampled: true, at: day })
    }
    if (s % 5 === 0) {
      push({ kind: 'angry_tap', route: '/p/:portal/feed', sessionId, subject, x: 196, y: 620, vw: 390, vh: 844, sampled: true, at: day })
    }
    if (s % 2 === 0) {
      push({ kind: 'clip_watch', route: '/p/:portal/feed', sessionId, subject, clipId: `c${s}`, watchPct: 40 + (s * 7) % 60, sampled: true, at: day })
    }
    if (s % 3 === 0) {
      push({ kind: 'clip_swipe', route: '/p/:portal/feed', sessionId, subject, watchPct: 20 + (s * 5) % 40, sampled: true, at: day })
    }
    if (s < 8) {
      const later = new Date(Date.parse(day) + 86_400_000).toISOString()
      push({ kind: 'route', route: '/p/:portal', sessionId: `${sessionId}-d1`, subject, sampled: true, at: later })
    }
  }
  for (let i = 0; i < jobs.length; i += 25) await Promise.all(jobs.slice(i, i + 25))
  await audit(payload, 'insights.test_data', { actor: actor.id, actorRole: actor.role, detail: { rows: n } })
  return n
}

export function experimentHint(route: string, reason: string) {
  const slot = route.includes('/feed') ? 'feed-cta-label' : route.includes('/lanes') ? 'lanes-tab-label' : 'feed-cta-label'
  return `/master/experiments/new?from=insight&slot=${encodeURIComponent(slot)}&reason=${encodeURIComponent(reason)}&route=${encodeURIComponent(route)}`
}
