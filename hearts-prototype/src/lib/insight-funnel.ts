/** Drop-off maths for the four key learner flows. Pure: no database. */

export const FUNNEL_STEPS = [
  { key: 'opening_questions', label: 'Opening questions' },
  { key: 'first_clip', label: 'First clip' },
  { key: 'course_start', label: 'Course start' },
  { key: 'study_plan_saved', label: 'Study plan saved' },
] as const

export type FunnelStepKey = (typeof FUNNEL_STEPS)[number]['key']

export function isFunnelStep(value: string): value is FunnelStepKey {
  return FUNNEL_STEPS.some((step) => step.key === value)
}

export type FunnelEvent = { sessionId: string; step: string; subject?: string }

export type FunnelRow = {
  key: FunnelStepKey
  label: string
  sessions: number
  fromStart: number
  fromPrevious: number
  dropOff: number
}

export type FunnelResult = {
  steps: FunnelRow[]
  started: number
  finished: number
  completion: number
}

export function funnelMaths(events: FunnelEvent[]): FunnelResult {
  const byStep = new Map<string, Set<string>>()
  for (const step of FUNNEL_STEPS) byStep.set(step.key, new Set())
  for (const event of events) {
    if (!isFunnelStep(event.step)) continue
    const id = event.sessionId || event.subject || ''
    if (!id) continue
    byStep.get(event.step)!.add(id)
  }
  const started = byStep.get('opening_questions')!.size
  const steps: FunnelRow[] = FUNNEL_STEPS.map((step, index) => {
    const sessions = byStep.get(step.key)!.size
    const previous = index === 0 ? sessions : byStep.get(FUNNEL_STEPS[index - 1].key)!.size
    const fromStart = started ? sessions / started : 0
    const fromPrevious = previous ? sessions / previous : 0
    const dropOff = previous ? Math.max(0, 1 - fromPrevious) : 0
    return { key: step.key, label: step.label, sessions, fromStart, fromPrevious, dropOff }
  })
  const finished = byStep.get('study_plan_saved')!.size
  return {
    steps,
    started,
    finished,
    completion: started ? finished / started : 0,
  }
}

export type RetentionPoint = { day: number; returned: number; rate: number }

/**
 * Day-N retention: of subjects first seen on a cohort day, how many came back
 * on day 1, 7, 14, 30. `firstSeen` and `visits` are ISO date strings (YYYY-MM-DD).
 */
export const RETURN_BUCKETS = ['0', '1', '2-7', '8+'] as const
export type ReturnBucket = (typeof RETURN_BUCKETS)[number]

export function isReturnBucket(value: string): value is ReturnBucket {
  return (RETURN_BUCKETS as readonly string[]).includes(value)
}

/** Coarse days-since-last-visit. The date itself never leaves the device. */
export function returnBucketFromDays(days: number | null | undefined): ReturnBucket | null {
  if (days == null || !Number.isFinite(days) || days < 0) return null
  if (days === 0) return '0'
  if (days === 1) return '1'
  if (days <= 7) return '2-7'
  return '8+'
}

/** Returns from visit-first-event buckets only. No person or device id. */
export function retentionFromBuckets(buckets: Array<string | null | undefined>): { cohort: number; points: RetentionPoint[]; buckets: Record<ReturnBucket, number> } {
  const held: ReturnBucket[] = []
  for (const raw of buckets) {
    const value = String(raw || '')
    if (isReturnBucket(value)) held.push(value)
  }
  const count = (want: ReturnBucket) => held.filter((row) => row === want).length
  const counts = { '0': count('0'), '1': count('1'), '2-7': count('2-7'), '8+': count('8+') }
  const cohort = held.length
  return {
    cohort,
    points: [
      { day: 1, returned: counts['1'], rate: cohort ? counts['1'] / cohort : 0 },
      { day: 7, returned: counts['2-7'], rate: cohort ? counts['2-7'] / cohort : 0 },
      { day: 8, returned: counts['8+'], rate: cohort ? counts['8+'] / cohort : 0 },
    ],
    buckets: counts,
  }
}

export function retentionByDay(
  firstSeen: Record<string, string>,
  visits: { subject: string; day: string }[],
  days: number[] = [1, 7, 14, 30],
): { cohort: number; points: RetentionPoint[] } {
  const cohort = Object.keys(firstSeen).length
  const bySubject = new Map<string, Set<string>>()
  for (const visit of visits) {
    if (!bySubject.has(visit.subject)) bySubject.set(visit.subject, new Set())
    bySubject.get(visit.subject)!.add(visit.day)
  }
  const points = days.map((day) => {
    let returned = 0
    for (const [subject, start] of Object.entries(firstSeen)) {
      const seen = bySubject.get(subject)
      if (!seen) continue
      const startMs = Date.parse(`${start}T00:00:00.000Z`)
      if (!Number.isFinite(startMs)) continue
      const want = new Date(startMs + day * 86_400_000).toISOString().slice(0, 10)
      if (seen.has(want)) returned += 1
    }
    return { day, returned, rate: cohort ? returned / cohort : 0 }
  })
  return { cohort, points }
}

export function pct(value: number) {
  return `${Math.round(value * 100)}%`
}
