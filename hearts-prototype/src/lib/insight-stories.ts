/**
 * Plain insights built from tap and watch counts.
 * No names, no typed answers, no model calls.
 */
import { replayLines } from './insight-events'
import { funnelMaths, retentionFromBuckets } from './insight-funnel'

export const INSIGHT_KEYS = ['leaving', 'returning', 'stuck', 'talks'] as const
export type InsightKey = (typeof INSIGHT_KEYS)[number]

export type InsightAction = 'experiment' | 'plan' | 'teacher' | 'talk'

export type InsightPoint = {
  kind: string
  route: string
  at?: string
  sessionId?: string
  step?: string
  clipId?: string
  watchPct?: number
  depth?: number
  portalId?: number | null
  returnBucket?: string
}

export type InsightNumber = { label: string; value: string }
export type InsightTrend = { day: string; label: string; n: number }
export type InsightDriver = { kind: 'portal' | 'course' | 'screen' | 'talk'; id: string; n: number }
export type InsightMoment = { line: string }

export type InsightStory = {
  key: InsightKey
  title: string
  line: string
  thin: boolean
  action: InsightAction
  actionLabel: string
  preset: string
  numbers: InsightNumber[]
  trend: InsightTrend[]
  drivers: InsightDriver[]
  moments: InsightMoment[]
}

const ACTION: Record<InsightKey, { action: InsightAction; actionLabel: string; preset: string; title: string }> = {
  leaving: { action: 'experiment', actionLabel: 'Start an experiment on this', preset: 'clip-button', title: 'People leave before a course' },
  returning: { action: 'plan', actionLabel: 'Make a study plan from this', preset: '', title: 'Who comes back' },
  stuck: { action: 'teacher', actionLabel: 'Message the teacher', preset: '', title: 'Repeated taps on one screen' },
  talks: { action: 'talk', actionLabel: 'Open the talk', preset: 'whole-talk', title: 'Which talks people stay with' },
}

export function isInsightKey(value: string | null | undefined): value is InsightKey {
  return (INSIGHT_KEYS as readonly string[]).includes(String(value || ''))
}

function dayKey(at?: string) {
  if (!at) return ''
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function dayLabel(day: string) {
  const date = new Date(`${day}T12:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return day
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

function trendFrom(points: InsightPoint[], keep: (point: InsightPoint) => boolean): InsightTrend[] {
  const bag = new Map<string, number>()
  for (const point of points) {
    if (!keep(point)) continue
    const day = dayKey(point.at)
    if (!day) continue
    bag.set(day, (bag.get(day) || 0) + 1)
  }
  return [...bag.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([day, n]) => ({ day, label: dayLabel(day), n }))
}

function topDrivers(rows: InsightDriver[], limit = 4) {
  return rows.sort((a, b) => b.n - a.n).slice(0, limit)
}

function courseId(route: string) {
  const match = /\/course\/(\d+)/.exec(route || '')
  return match?.[1] || ''
}

function driversFor(points: InsightPoint[], keep: (point: InsightPoint) => boolean): InsightDriver[] {
  const portals = new Map<string, number>()
  const courses = new Map<string, number>()
  const screens = new Map<string, number>()
  const talks = new Map<string, number>()
  for (const point of points) {
    if (!keep(point)) continue
    if (point.portalId) portals.set(String(point.portalId), (portals.get(String(point.portalId)) || 0) + 1)
    const course = courseId(point.route)
    if (course) courses.set(course, (courses.get(course) || 0) + 1)
    if (point.route) screens.set(point.route, (screens.get(point.route) || 0) + 1)
    if (point.clipId) talks.set(point.clipId, (talks.get(point.clipId) || 0) + 1)
  }
  return [
    ...topDrivers([...portals.entries()].map(([id, n]) => ({ kind: 'portal' as const, id, n }))),
    ...topDrivers([...courses.entries()].map(([id, n]) => ({ kind: 'course' as const, id, n }))),
    ...topDrivers([...talks.entries()].map(([id, n]) => ({ kind: 'talk' as const, id, n }))),
    ...topDrivers([...screens.entries()].map(([id, n]) => ({ kind: 'screen' as const, id, n }))),
  ]
}

function momentsFor(points: InsightPoint[], keep: (point: InsightPoint) => boolean): InsightMoment[] {
  const bySession = new Map<string, InsightPoint[]>()
  for (const point of points) {
    if (!keep(point) || !point.sessionId) continue
    if (!bySession.has(point.sessionId)) bySession.set(point.sessionId, [])
    bySession.get(point.sessionId)!.push(point)
  }
  const richest = [...bySession.entries()].sort((a, b) => b[1].length - a[1].length)[0]
  if (!richest) return []
  const ordered = [...richest[1]].sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')))
  return replayLines(ordered.map((point) => ({
    kind: point.kind,
    route: point.route,
    watchPct: point.watchPct,
    depth: point.depth,
  }))).slice(0, 6).map((line) => ({ line: line.text }))
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`
}

function shell(key: InsightKey, line: string, thin: boolean, rest: Pick<InsightStory, 'numbers' | 'trend' | 'drivers' | 'moments'>): InsightStory {
  const action = ACTION[key]
  return { key, title: action.title, line, thin, action: action.action, actionLabel: action.actionLabel, preset: action.preset, ...rest }
}

export function buildInsightStories(points: InsightPoint[]): InsightStory[] {
  const funnel = funnelMaths(points.filter((point) => point.kind === 'funnel').map((point) => ({
    sessionId: String(point.sessionId || ''),
    step: String(point.step || ''),
  })))
  const left = Math.max(0, funnel.started - (funnel.steps.find((step) => step.key === 'course_start')?.sessions || 0))
  const leavingKeep = (point: InsightPoint) => point.kind === 'funnel'
  const leaving = shell(
    'leaving',
    funnel.started
      ? `${left} of ${funnel.started} who opened the questions did not reach a course.`
      : 'Not enough visits yet to see where people leave.',
    funnel.started === 0,
    {
      numbers: [
        { label: 'Opened the questions', value: String(funnel.started) },
        { label: 'Reached a course', value: String(funnel.steps.find((step) => step.key === 'course_start')?.sessions || 0) },
        { label: 'Left before a course', value: String(left) },
      ],
      trend: trendFrom(points, leavingKeep),
      drivers: driversFor(points, leavingKeep),
      moments: momentsFor(points, (point) => point.kind === 'funnel' || point.kind === 'route' || point.kind === 'tap'),
    },
  )

  const buckets = points.map((point) => point.returnBucket).filter(Boolean)
  const retention = retentionFromBuckets(buckets)
  const returningKeep = (point: InsightPoint) => Boolean(point.returnBucket) || point.kind === 'route'
  const returning = shell(
    'returning',
    retention.cohort
      ? `${pct(retention.points[0]?.rate || 0)} of returning visits came back the next day.`
      : 'Not enough return visits yet.',
    retention.cohort === 0,
    {
      numbers: [
        { label: 'Visits with a return note', value: String(retention.cohort) },
        { label: 'Back the next day', value: pct(retention.points[0]?.rate || 0) },
        { label: 'Back within a week', value: pct(retention.points[1]?.rate || 0) },
      ],
      trend: trendFrom(points, (point) => Boolean(point.returnBucket)),
      drivers: driversFor(points, returningKeep),
      moments: momentsFor(points, (point) => point.kind === 'route' || point.kind === 'tap'),
    },
  )

  const angry = points.filter((point) => point.kind === 'angry_tap')
  const screens = new Set(angry.map((point) => point.route).filter(Boolean))
  const stuck = shell(
    'stuck',
    angry.length
      ? `${angry.length} repeated taps, on ${screens.size} ${screens.size === 1 ? 'screen' : 'screens'}.`
      : 'No repeated taps on a stuck control.',
    angry.length === 0,
    {
      numbers: [
        { label: 'Repeated taps', value: String(angry.length) },
        { label: 'Screens', value: String(screens.size) },
      ],
      trend: trendFrom(points, (point) => point.kind === 'angry_tap'),
      drivers: driversFor(points, (point) => point.kind === 'angry_tap'),
      moments: momentsFor(points, (point) => point.kind === 'angry_tap' || point.kind === 'route' || point.kind === 'tap'),
    },
  )

  const watches = points.filter((point) => point.kind === 'clip_watch' && point.watchPct != null)
  const pcts = watches.map((point) => Number(point.watchPct)).filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  const median = pcts.length ? pcts[Math.floor(pcts.length / 2)] : 0
  const talks = shell(
    'talks',
    watches.length
      ? `${watches.length} clips watched, typically to ${Math.round(median)}%.`
      : 'No clip watches yet.',
    watches.length === 0,
    {
      numbers: [
        { label: 'Clips watched', value: String(watches.length) },
        { label: 'Typical watch', value: `${Math.round(median)}%` },
        { label: 'Swipes away', value: String(points.filter((point) => point.kind === 'clip_swipe').length) },
      ],
      trend: trendFrom(points, (point) => point.kind === 'clip_watch'),
      drivers: driversFor(points, (point) => point.kind === 'clip_watch' || point.kind === 'clip_swipe'),
      moments: momentsFor(points, (point) => point.kind === 'clip_watch' || point.kind === 'clip_swipe' || point.kind === 'route'),
    },
  )

  return [leaving, returning, stuck, talks]
}
