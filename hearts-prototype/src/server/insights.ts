import type { Payload, Where } from 'payload'
import { now } from '@/lib/clock'
import { isProduction, isRemoteDatabase } from '@/lib/env'
import { FUNNEL_STEPS, funnelMaths, retentionFromBuckets, type FunnelResult } from '@/lib/insight-funnel'
import { heatmapGrid, type HeatCell } from '@/lib/insight-taps'
import { allowInsightIngest, angrySpotWords, DEFAULT_SAMPLE_RATE, insightEventRow, isAnswerScreen, isInsightKind, isPrivateLane, normaliseRoute, replayLines, routeWords, sampleSession, sessionReplayScore, shouldKeep } from '@/lib/insight-events'
import { buildInsightStories, type InsightDriver, type InsightPoint, type InsightStory } from '@/lib/insight-stories'
import { flattenSlots, planAcrossDays, studyDates } from '@/lib/schedule'

export { insightEventRow } from '@/lib/insight-events'
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
    clientIp?: string | null
    userAgent?: string | null
    events: IncomingEvent[]
  },
) {
  const optedIn = Boolean(input.user && 'trendsOptIn' in input.user && input.user.trendsOptIn)
  const rate = await sampleRateOf(payload)
  if (!allowInsightIngest({ deviceId: input.deviceId, clientIp: input.clientIp, userAgent: input.userAgent }, 40, 10_000)) return { stored: 0, limited: true }
  let stored = 0
  const stamp = now()
  for (const [index, raw] of input.events.slice(0, 20).entries()) {
    if (!isInsightKind(raw.kind)) continue
    const sessionId = String(raw.sessionId || '').slice(0, 48)
    if (!sessionId || /learner/i.test(sessionId)) continue
    const sampled = sampleSession(sessionId, rate)
    if (!shouldKeep(raw.kind, sampled)) continue
    const route = normaliseRoute(raw.route || '/')
    const props = raw.props || {}
    const lane = String((props as { lane?: string }).lane || '')
    if (isPrivateLane(lane)) continue
    const hideCoords = isAnswerScreen(route, { sheet: Boolean((props as { sheet?: boolean }).sheet) }) || !optedIn
    const at = new Date(stamp.getTime() + index).toISOString()
    try {
      const data = insightEventRow({
        kind: raw.kind,
        route,
        sessionId,
        portalId: input.portalId,
        sampled,
        props: raw.props,
        x: raw.x,
        y: raw.y,
        vw: raw.vw,
        vh: raw.vh,
        depth: raw.depth,
        clipId: raw.clipId,
        watchPct: raw.watchPct,
        step: raw.step,
        interactive: raw.interactive,
        at,
        hideCoords,
      })
      await payload.create({
        collection: col('insight-events'),
        overrideAccess: true,
        data: data as never,
      })
      stored += 1
      if (raw.kind === 'route') {
        await touchSession(payload, {
          sessionId,
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
      subject: input.sessionId,
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
      sessionId: input.sessionId || `funnel-${Math.random().toString(36).slice(2, 10)}`,
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
  portal?: unknown
  props?: { returnBucket?: string } | null
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

function insightRange(query: { portal?: string; from?: string; to?: string }): Where | undefined {
  const parts: Where[] = []
  const portal = Number(query.portal)
  if (portal > 0) parts.push({ portal: { equals: portal } })
  if (query.from && /^\d{4}-\d{2}-\d{2}$/.test(query.from)) parts.push({ at: { greater_than_equal: `${query.from}T00:00:00.000Z` } })
  if (query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to)) {
    const end = new Date(`${query.to}T00:00:00.000Z`)
    end.setUTCDate(end.getUTCDate() + 1)
    parts.push({ at: { less_than: end.toISOString() } })
  }
  if (!parts.length) return undefined
  return parts.length === 1 ? parts[0] : { and: parts }
}

function toPoints(events: EventRow[]): InsightPoint[] {
  return events.map((row) => ({
    kind: String(row.kind || ''),
    route: String(row.route || '/'),
    at: row.at,
    sessionId: row.sessionId,
    step: row.step || undefined,
    clipId: row.clipId || undefined,
    watchPct: row.watchPct ?? undefined,
    depth: row.depth ?? undefined,
    portalId: idOf(row.portal),
    returnBucket: row.props?.returnBucket,
  }))
}

export type StoryDriver = { kind: string; label: string; n: number }

export type PresentedStory = InsightStory & {
  driverLines: StoryDriver[]
  talkHref: string
  talkTitle: string
  planPortalId: number | null
  planPortalSlug: string
}

async function presentStories(payload: Payload, stories: InsightStory[], actor: InsightActor, portalQuery?: string): Promise<PresentedStory[]> {
  const drivers = stories.flatMap((story) => story.drivers)
  const portalIds = [...new Set(drivers.filter((row) => row.kind === 'portal').map((row) => Number(row.id)).filter((id) => id > 0))]
  const courseIds = [...new Set(drivers.filter((row) => row.kind === 'course').map((row) => Number(row.id)).filter((id) => id > 0))]
  const talkIds = [...new Set(drivers.filter((row) => row.kind === 'talk').map((row) => row.id))]
  const numericTalks = talkIds.map((id) => Number(id)).filter((id) => id > 0)
  const [portals, courses, lessons, fallbackLessons, chosenPortal] = await Promise.all([
    portalIds.length ? payload.find({ collection: 'portals', overrideAccess: true, depth: 0, limit: portalIds.length, where: { id: { in: portalIds } } }) : Promise.resolve({ docs: [] as { id: number; name?: string }[] }),
    courseIds.length ? payload.find({ collection: 'courses', overrideAccess: true, depth: 0, limit: courseIds.length, where: { id: { in: courseIds } } }) : Promise.resolve({ docs: [] as { id: number; title?: string }[] }),
    numericTalks.length ? payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: numericTalks.length, where: { id: { in: numericTalks } } }) : Promise.resolve({ docs: [] as { id: number; title?: string; course?: unknown }[] }),
    payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: 12, sort: 'order' }),
    resolvePlanPortal(payload, actor, portalQuery),
  ])
  const portalName = new Map(portals.docs.map((row) => [String(row.id), String((row as { name?: string }).name || 'A portal')]))
  const courseName = new Map(courses.docs.map((row) => [String(row.id), String((row as { title?: string }).title || 'A course')]))
  const lessonName = new Map(lessons.docs.map((row) => [String(row.id), String((row as { title?: string }).title || 'A talk')]))
  const lessonCourse = new Map(lessons.docs.map((row) => [String(row.id), idOf((row as { course?: unknown }).course)]))
  const fallback = (fallbackLessons.docs as { id: number; title?: string; course?: unknown; publishState?: string }[]).find((row) => row.publishState !== 'draft') || fallbackLessons.docs[0] as { id: number; title?: string; course?: unknown } | undefined
  const labelOf = (driver: InsightDriver) => {
    if (driver.kind === 'portal') return portalName.get(driver.id) || 'A portal'
    if (driver.kind === 'course') return courseName.get(driver.id) || 'A course'
    if (driver.kind === 'talk') return lessonName.get(driver.id) || 'A short clip'
    return routeWords(driver.id)
  }
  return stories.map((story) => {
    const matched = story.drivers.find((row) => row.kind === 'talk' && lessonCourse.get(row.id))
    const courseId = matched ? lessonCourse.get(matched.id) : idOf(fallback?.course)
    const lessonId = matched ? Number(matched.id) : fallback?.id
    const talkHref = courseId && lessonId ? `/master/library/${courseId}?part=${lessonId}` : '/master/library'
    const talkTitle = matched ? lessonName.get(matched.id) || 'A talk' : String(fallback?.title || 'A talk')
    return {
      ...story,
      driverLines: story.drivers.slice(0, 8).map((row) => ({ kind: row.kind, label: labelOf(row), n: row.n })),
      talkHref,
      talkTitle,
      planPortalId: chosenPortal?.id || null,
      planPortalSlug: chosenPortal?.slug || '',
    }
  })
}

async function resolvePlanPortal(payload: Payload, actor: InsightActor, portalQuery?: string) {
  const asked = Number(portalQuery)
  let id = asked > 0 ? asked : actor.role === 'master' ? null : portalIdOf(actor)
  if (!id) {
    const elm = await payload.find({ collection: 'portals', overrideAccess: true, depth: 0, limit: 1, where: { slug: { equals: 'east-london' } } })
    id = elm.docs[0]?.id || null
  }
  if (!id) {
    const any = await payload.find({ collection: 'portals', overrideAccess: true, depth: 0, limit: 1, sort: 'name' })
    id = any.docs[0]?.id || null
  }
  if (!id) return null
  const doc = await payload.findByID({ collection: 'portals', id, depth: 0, overrideAccess: true }).catch(() => null) as { id: number; slug?: string; name?: string } | null
  if (!doc) return null
  return { id: doc.id, slug: String(doc.slug || ''), name: String(doc.name || 'This portal') }
}

export type InsightsDesk = {
  routes: { route: string; taps: number; angry: number; sessions: number }[]
  heatmap: { route: string; cells: HeatCell[]; max: number; taps: number }
  funnel: FunnelResult
  angry: { id: number; route: string; x: number; y: number; at: string; sessionId: string; place: string }[]
  retention: { cohort: number; points: { day: number; returned: number; rate: number }[] }
  watch: { clips: number; medianPct: number; swipeAway: number }
  scroll: { route: string; max: number }[]
  replay: { sessionId: string; events: { kind: string; route: string; x?: number; y?: number; at?: string; watchPct?: number; depth?: number; line: string }[] } | null
  sampleRate: number
  testData: boolean
  stories: PresentedStory[]
}

export async function insightsDesk(payload: Payload, actor: InsightActor, query: { route?: string; session?: string; portal?: string; from?: string; to?: string } = {}): Promise<InsightsDesk> {
  assertView(actor)
  const events = await loadEvents(payload, actor, insightRange(query))
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
  const returnBuckets: string[] = []
  const seenSession = new Set<string>()
  for (const row of events) {
    const session = String(row.sessionId || '')
    const bucket = String(row.props?.returnBucket || '')
    if (!session || seenSession.has(session) || !bucket) continue
    seenSession.add(session)
    returnBuckets.push(bucket)
  }
  const watchRows = events.filter((row) => row.kind === 'clip_watch' && row.watchPct != null)
  const pcts = watchRows.map((row) => Number(row.watchPct)).sort((a, b) => a - b)
  const swipeAway = events.filter((row) => row.kind === 'clip_swipe').length
  const bySession = new Map<string, EventRow[]>()
  for (const row of events) {
    if (!row.sessionId) continue
    if (!bySession.has(row.sessionId)) bySession.set(row.sessionId, [])
    bySession.get(row.sessionId)!.push(row)
  }
  const labelledJourney = bySession.has('test-sess-journey') ? 'test-sess-journey' : ''
  const richest = labelledJourney || [...bySession.entries()].sort((a, b) => sessionReplayScore(b[1]) - sessionReplayScore(a[1]))[0]?.[0] || ''
  const replayId = query.session || richest || events.find((row) => row.kind === 'route')?.sessionId || ''
  const rawReplay = replayId
    ? events
      .filter((row) => row.sessionId === replayId && (row.kind === 'route' || row.kind === 'tap' || row.kind === 'angry_tap' || row.kind === 'clip_watch' || row.kind === 'clip_swipe' || row.kind === 'scroll'))
      .sort((a, b) => String(a.at).localeCompare(String(b.at)))
    : []
  const replayEvents = replayLines(rawReplay.map((row) => ({
    kind: String(row.kind),
    route: String(row.route),
    watchPct: row.watchPct ?? undefined,
    depth: row.depth ?? undefined,
  }))).map((line, index) => {
    const row = rawReplay[Math.min(index, rawReplay.length - 1)]
    return {
      kind: line.kind,
      route: line.route,
      x: row?.x ?? undefined,
      y: row?.y ?? undefined,
      at: row?.at,
      watchPct: rawReplay.find((item) => item.kind === line.kind && item.watchPct != null)?.watchPct ?? undefined,
      depth: rawReplay.find((item) => item.kind === line.kind && item.depth != null)?.depth ?? undefined,
      line: line.text,
    }
  })
  return {
    routes,
    heatmap: { route, cells, max: Math.max(1, ...cells.map((cell) => cell.n)), taps: taps.length },
    funnel,
    angry,
    retention: retentionFromBuckets(returnBuckets),
    watch: {
      clips: watchRows.length,
      medianPct: pcts.length ? pcts[Math.floor(pcts.length / 2)] : 0,
      swipeAway,
    },
    replay: replayId ? { sessionId: replayId, events: replayEvents } : null,
    sampleRate: await sampleRateOf(payload),
    scroll: [...scrollByRoute.entries()].map(([route, max]) => ({ route, max })).sort((a, b) => b.max - a.max),
    testData: events.some((row) => String(row.subject || '').startsWith('test-data:')),
    stories: await presentStories(payload, buildInsightStories(toPoints(events)), actor, query.portal),
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
    const bucket = s % 8 === 0 ? '1' : s % 8 === 1 ? '2-7' : s % 8 === 2 ? '8+' : s % 8 === 3 ? '0' : undefined
    push({ kind: 'route', route: routes[s % 3], sessionId, subject, sampled: true, at: day, props: { test: true, ...(bucket ? { returnBucket: bucket } : {}) } })
    push({ kind: 'funnel', route: '/p/:portal/start', sessionId, subject, step: 'opening_questions', sampled: true, at: day })
    if (s < 18) push({ kind: 'funnel', route: '/p/:portal/feed', sessionId, subject, step: 'first_clip', sampled: true, at: day })
    if (s < 10) push({ kind: 'funnel', route: '/p/:portal/course/1', sessionId, subject, step: 'course_start', sampled: true, at: day })
    if (s < 6) push({ kind: 'funnel', route: '/p/:portal/me/plan', sessionId, subject, step: 'study_plan_saved', sampled: true, at: day })
    const spots = [
      { x: 196, y: 718, n: 3 },
      { x: 348, y: 392, n: 2 },
      { x: 196, y: 428, n: 2 },
      { x: 188, y: 268, n: 2 },
      { x: 56, y: 88, n: 1 },
      { x: 78, y: 804, n: 1 },
      { x: 196, y: 804, n: 2 },
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
  const journeyId = 'test-sess-journey'
  const journeySubject = 'test-data:journey'
  const journeyAt = (step: number) => new Date(stamp.getTime() - 2 * 86_400_000 + step * 45_000).toISOString()
  const journey: { kind: string; route: string; step?: string; watchPct?: number; depth?: number; x?: number; y?: number }[] = [
    { kind: 'route', route: '/p/:portal' },
    { kind: 'tap', route: '/p/:portal', x: 196, y: 520 },
    { kind: 'route', route: '/p/:portal/start' },
    { kind: 'funnel', route: '/p/:portal/start', step: 'opening_questions' },
    { kind: 'route', route: '/p/:portal/feed' },
    { kind: 'funnel', route: '/p/:portal/feed', step: 'first_clip' },
    { kind: 'clip_watch', route: '/p/:portal/feed', watchPct: 72 },
    { kind: 'scroll', route: '/p/:portal/feed', depth: 64 },
    { kind: 'tap', route: '/p/:portal/feed', x: 196, y: 718 },
    { kind: 'route', route: '/p/:portal/course/1' },
    { kind: 'funnel', route: '/p/:portal/course/1', step: 'course_start' },
    { kind: 'route', route: '/p/:portal/me/plan' },
    { kind: 'funnel', route: '/p/:portal/me/plan', step: 'study_plan_saved' },
  ]
  journey.forEach((event, index) => {
    push({
      ...event,
      sessionId: journeyId,
      subject: journeySubject,
      sampled: true,
      at: journeyAt(index),
      ...(event.x != null ? { x: event.x, y: event.y, vw: 390, vh: 844 } : {}),
    })
  })
  for (let i = 0; i < jobs.length; i += 25) await Promise.all(jobs.slice(i, i + 25))
  await audit(payload, 'insights.test_data', { actor: actor.id, actorRole: actor.role, detail: { rows: n } })
  return n
}

const PLAN_NAME = 'From Insights'

export async function planFromInsight(payload: Payload, actor: InsightActor, portalId?: number | null) {
  if (actor.role !== 'master' && actor.role !== 'portal-admin') throw new Error('A study plan from Insights is for the master desk or a portal admin.')
  const portal = await resolvePlanPortal(payload, actor, portalId ? String(portalId) : '')
  if (!portal) throw new Error('There is no portal to plan for.')
  const lessons = await payload.find({
    collection: 'lessons',
    overrideAccess: true,
    depth: 0,
    limit: 40,
    sort: 'order',
  })
  const first = (lessons.docs as { id: number; title?: string; course?: unknown; publishState?: string }[]).find((row) => idOf(row.course) && row.publishState !== 'draft')
    || (lessons.docs as { id: number; title?: string; course?: unknown }[])[0]
  const courseId = idOf(first?.course)
  if (!courseId) throw new Error('There is no talk to spread across a plan yet.')
  const courseLessons = (lessons.docs as { id: number; title?: string; course?: unknown }[]).filter((row) => idOf(row.course) === courseId).slice(0, 12)
  const learner = await payload.find({
    collection: 'users',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    sort: 'name',
    where: { and: [{ role: { equals: 'learner' } }, { 'tenants.tenant': { equals: portal.id } }] },
  })
  const learnerId = learner.docs[0]?.id
  if (!learnerId) throw new Error('This portal has no learner to plan for yet.')
  const start = now().toISOString().slice(0, 10)
  const end = new Date(now().getTime() + 27 * 86_400_000).toISOString().slice(0, 10)
  const dates = studyDates(start, end, [2, 4])
  const planned = planAcrossDays(courseLessons.map((row) => ({
    id: row.id,
    title: String(row.title || 'Sitting'),
    courseId,
  })), dates)
  const slots = flattenSlots(planned.slots)
  const data = {
    name: PLAN_NAME,
    owner: actor.id,
    learners: [learnerId],
    targetType: 'course',
    course: courseId,
    startDate: start,
    endDate: end,
    weekdays: [2, 4],
    slots,
    minutesPerDay: 20,
    portal: portal.id,
  }
  const existing = await payload.find({
    collection: 'schedules',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { and: [{ portal: { equals: portal.id } }, { name: { equals: PLAN_NAME } }] },
  })
  if (existing.docs[0]) await payload.update({ collection: 'schedules', id: existing.docs[0].id, overrideAccess: true, data: data as never })
  else await payload.create({ collection: 'schedules', overrideAccess: true, data: data as never })
  const learnerName = String((learner.docs[0] as { name?: string }).name || 'the learner')
  const noteKey = `insight-plan-${portal.id}-${learnerId}`
  const prior = await payload.find({ collection: 'notifications', overrideAccess: true, depth: 0, limit: 1, where: { and: [{ user: { equals: learnerId } }, { key: { equals: noteKey } }] } })
  const note = {
    user: learnerId,
    portal: portal.id,
    title: 'A study plan was made for you',
    body: `${PLAN_NAME}. It is on My week.`,
    href: `/p/${portal.slug}/week`,
    key: noteKey,
    read: false,
  }
  if (prior.docs[0]) await payload.update({ collection: 'notifications', id: prior.docs[0].id, overrideAccess: true, data: note })
  else await payload.create({ collection: 'notifications', overrideAccess: true, data: note })
  await audit(payload, 'insights.plan', { actor: actor.id, actorRole: actor.role, portal: portal.id, detail: { courseId, learnerId, slots: slots.length } })
  return { name: PLAN_NAME, learnerName, portalName: portal.name }
}

export async function messageTeacherFromInsight(payload: Payload, actor: InsightActor, portalId?: number | null) {
  if (!canViewInsights(actor)) throw new Error('Insights are for the master desk and portal admins.')
  const portal = await resolvePlanPortal(payload, actor, portalId ? String(portalId) : '')
  if (!portal) throw new Error('There is no portal to message.')
  const teachers = await payload.find({
    collection: 'users',
    overrideAccess: true,
    depth: 0,
    limit: 10,
    where: { and: [{ role: { equals: 'teacher' } }, { 'tenants.tenant': { equals: portal.id } }] },
  })
  let people = teachers.docs as { id: number; name?: string | null }[]
  if (!people.length) {
    const admins = await payload.find({
      collection: 'users',
      overrideAccess: true,
      depth: 0,
      limit: 5,
      where: { and: [{ role: { equals: 'portal-admin' } }, { 'tenants.tenant': { equals: portal.id } }] },
    })
    people = admins.docs as { id: number; name?: string | null }[]
  }
  if (!people.length) throw new Error('This portal has no teacher to message.')
  const names: string[] = []
  for (const person of people) {
    const key = `insight-teacher-${portal.id}-${person.id}`
    const data = {
      user: person.id,
      portal: portal.id,
      title: 'A note from Insights',
      body: 'People are tapping the same spot and not moving on. Have a look when you can.',
      href: `/p/${portal.slug}/admin/teach`,
      key,
      read: false,
    }
    const existing = await payload.find({ collection: 'notifications', overrideAccess: true, depth: 0, limit: 1, where: { and: [{ user: { equals: person.id } }, { key: { equals: key } }] } })
    if (existing.docs[0]) await payload.update({ collection: 'notifications', id: existing.docs[0].id, overrideAccess: true, data })
    else await payload.create({ collection: 'notifications', overrideAccess: true, data })
    if (person.name) names.push(person.name)
  }
  await audit(payload, 'insights.message_teacher', { actor: actor.id, actorRole: actor.role, portal: portal.id, detail: { teachers: people.length } })
  return { names: names.join(', ') || 'the teacher', portalName: portal.name }
}

export function experimentHint(route: string, reason: string) {
  const slot = route.includes('/feed') ? 'feed-cta-label' : route.includes('/lanes') ? 'lanes-tab-label' : 'feed-cta-label'
  return `/master/experiments/new?from=insight&slot=${encodeURIComponent(slot)}&reason=${encodeURIComponent(reason)}&route=${encodeURIComponent(route)}`
}
