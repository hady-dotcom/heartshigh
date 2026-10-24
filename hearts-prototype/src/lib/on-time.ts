// "On time" for the Teach desk. A part counts when the learner finished it on or before the
// earliest day a study plan scheduled it. The column is that count out of the parts due by today.

export const ON_TIME_HINT = 'Parts finished by the day their study plan scheduled them, out of the parts due by today.'

export type PlanSlot = { lessonId: number; date: string }
export type Watch = { lessonId: number; watchedOn: string }

export type OnTimeProgress = {
  /** Parts due by today that were finished on or before their scheduled day. */
  onTime: number
  /** Parts whose earliest scheduled day is today or earlier. */
  due: number
  /** Distinct parts on the learner's plans, including ones not due yet. */
  planned: number
}

/** First ten characters when they are a calendar day, otherwise the UTC day of a parseable time. */
export function dateKey(value: unknown): string {
  if (value == null || value === '') return ''
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10)
  const text = String(value)
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(text)
  if (iso) return iso[1]
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return iso
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days))
  return date.toISOString().slice(0, 10)
}

/** True when the watch falls on or before the earliest scheduled day. No plan means not on time. */
export function finishedBySchedule(dates: string[], watchedOn: string): boolean {
  const scheduled = dates.map((date) => dateKey(date)).filter(Boolean).sort()
  const watched = dateKey(watchedOn)
  if (!scheduled.length || !watched) return false
  return watched <= scheduled[0]
}

/**
 * Earliest scheduled day per part. Parts due after today are not in the denominator yet,
 * so finishing one early does not change the fraction until that day arrives.
 */
export function onTimeProgress(slots: PlanSlot[], watches: Watch[], today: string): OnTimeProgress {
  const dueDate = new Map<number, string>()
  for (const slot of slots) {
    const date = dateKey(slot.date)
    if (!slot.lessonId || !date) continue
    const prev = dueDate.get(slot.lessonId)
    if (!prev || date < prev) dueDate.set(slot.lessonId, date)
  }
  const watchedOn = new Map<number, string>()
  for (const watch of watches) {
    const date = dateKey(watch.watchedOn)
    if (!watch.lessonId || !date) continue
    const prev = watchedOn.get(watch.lessonId)
    if (!prev || date < prev) watchedOn.set(watch.lessonId, date)
  }
  const day = dateKey(today)
  let due = 0
  let onTime = 0
  for (const [lessonId, date] of dueDate) {
    if (!day || date > day) continue
    due += 1
    const when = watchedOn.get(lessonId)
    if (when && when <= date) onTime += 1
  }
  return { onTime, due, planned: dueDate.size }
}

/** "7 of 7", or an em dash when this learner has no study plan. */
export function formatOnTime(progress: OnTimeProgress) {
  if (!progress.planned) return '—'
  return `${progress.onTime} of ${progress.due}`
}

export type DemoProfile = 'on-schedule' | 'behind' | 'ahead' | 'answers-late'

export type DemoPerson = {
  key: DemoProfile
  name: string
  email: string
  watches: { lessonId: number; watchedOn: string }[]
  answers: { lessonId: number; answeredOn: string }[]
}

export type DemoTimeline = {
  slots: PlanSlot[]
  people: DemoPerson[]
}

const DEMO_LESSONS = 9

/**
 * Four demo histories over nine parts, scheduled one a day from six days ago through two days ahead.
 * The numbers are fixed so the Teach columns come out different for each person.
 */
export function demoTimeline(today: string, lessonIds: number[]): DemoTimeline {
  if (lessonIds.length < DEMO_LESSONS) throw new Error(`The demo needs ${DEMO_LESSONS} parts and was given ${lessonIds.length}.`)
  const ids = lessonIds.slice(0, DEMO_LESSONS)
  const slots = ids.map((lessonId, index) => ({ lessonId, date: addDays(today, index - 6) }))
  const onDay = (index: number) => slots[index].date
  const watch = (index: number, day: string) => ({ lessonId: ids[index], watchedOn: day })
  const answer = (index: number, day: string) => ({ lessonId: ids[index], answeredOn: day })
  const people: DemoPerson[] = [
    {
      key: 'on-schedule',
      name: 'Layla Rahman (demo)',
      email: 'demo-layla@hearts-demo.test',
      watches: [0, 1, 2, 3, 4, 5, 6].map((index) => watch(index, onDay(index))),
      answers: [0, 2, 4, 6].map((index) => answer(index, onDay(index))),
    },
    {
      key: 'behind',
      name: 'Yusuf Karim (demo)',
      email: 'demo-yusuf@hearts-demo.test',
      watches: [watch(0, onDay(0)), watch(1, addDays(onDay(1), 2)), watch(2, addDays(onDay(2), 2))],
      answers: [answer(1, addDays(onDay(1), 2))],
    },
    {
      key: 'ahead',
      name: 'Amina Shah (demo)',
      email: 'demo-amina@hearts-demo.test',
      watches: [...[0, 1, 2, 3, 4, 5, 6].map((index) => watch(index, onDay(index))), watch(7, today), watch(8, today)],
      answers: [0, 1, 2, 3, 4, 5].map((index) => answer(index, onDay(index))),
    },
    {
      key: 'answers-late',
      name: 'Hassan Malik (demo)',
      email: 'demo-hassan@hearts-demo.test',
      watches: [0, 1, 2, 3, 4].map((index) => watch(index, onDay(index))),
      answers: [0, 1, 2, 3, 4].map((index) => answer(index, addDays(onDay(index), 3))),
    },
  ]
  return { slots, people }
}
