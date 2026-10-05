import { planAcrossDays } from '@/lib/schedule'

/** Monday-first weeks and British dates for My week and the Home strip. Learner times use Toronto unless a portal zone is set. */

export const LEARNER_ZONE = 'America/Toronto'

const WEEKDAY_LONG = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays']
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function zoneOrToronto(timeZone?: string | null) {
  return timeZone && timeZone.trim() ? timeZone.trim() : LEARNER_ZONE
}

function partsInZone(date: Date, timeZone: string) {
  const bits = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(date)
  const read = (type: string) => bits.find((bit) => bit.type === type)?.value || ''
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(read('weekday'))
  return { year: Number(read('year')), month: Number(read('month')), day: Number(read('day')), weekday: weekday >= 0 ? weekday : date.getUTCDay() }
}

export function dateKeyInZone(date: Date, timeZone = LEARNER_ZONE) {
  const { year, month, day } = partsInZone(date, timeZone)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Monday of the week that contains `date`, as a YYYY-MM-DD key in that zone. */
export function mondayKey(date: Date, timeZone = LEARNER_ZONE) {
  const { year, month, day, weekday } = partsInZone(date, timeZone)
  const utc = Date.UTC(year, month - 1, day)
  const back = weekday === 0 ? 6 : weekday - 1
  return dateKeyInZone(new Date(utc - back * 86_400_000), 'UTC')
}

export type WeekDay = { key: string; label: string; day: number; weekday: number; today: boolean }

/** Seven days, Monday first, with today marked. */
export function weekStrip(now: Date, timeZone = LEARNER_ZONE): WeekDay[] {
  const monday = mondayKey(now, timeZone)
  const today = dateKeyInZone(now, timeZone)
  const start = new Date(`${monday}T12:00:00Z`)
  return Array.from({ length: 7 }, (_, index) => {
    const at = new Date(start.getTime() + index * 86_400_000)
    const key = dateKeyInZone(at, 'UTC')
    const weekday = (index + 1) % 7
    return { key, label: WEEKDAY_SHORT[weekday], day: at.getUTCDate(), weekday, today: key === today }
  })
}

const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** British dates without the host ICU, so the client and the server write the same words. */
export function formatLearnerDate(iso: string, style: 'long' | 'short' | 'week' = 'short') {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) return ''
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!month || month > 12 || !day || day > 31) return ''
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  if (Number.isNaN(date.getTime()) || date.getUTCDate() !== day) return ''
  const weekday = WEEKDAY_SHORT[date.getUTCDay()]
  const monthName = MONTHS_LONG[month - 1]
  if (style === 'long') return `${day} ${monthName} ${year}`
  return `${weekday} ${day} ${monthName}`
}

export function weekdayList(weekdays: number[]): string {
  const names = [...weekdays].sort((a, b) => ((a === 0 ? 7 : a) - (b === 0 ? 7 : b))).map((day) => WEEKDAY_LONG[day]).filter(Boolean)
  if (!names.length) return ''
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function talksLabel(talks: number, seconds: number) {
  const hours = seconds >= 3600 ? Math.max(1, Math.round(seconds / 3600)) : 0
  const minutes = seconds > 0 && seconds < 3600 ? Math.max(1, Math.round(seconds / 60)) : 0
  const count = `${talks} talk${talks === 1 ? '' : 's'}`
  if (hours) return `${count} · about ${hours} hour${hours === 1 ? '' : 's'}`
  if (minutes) return `${count} · about ${minutes} min`
  return count
}

export function minutesLabel(seconds: number) {
  if (!seconds) return ''
  return `${Math.max(1, Math.round(seconds / 60))} min`
}

/** Dates a plan will actually use. One talk stays on the first day; fewer talks than days are spaced (3 over 12 → 1, 5, 9). */
export function fitDatesToTalks(dates: string[], talks: number): { dates: string[]; note: string | null } {
  if (talks <= 0 || !dates.length) return { dates: [], note: null }
  const planned = planAcrossDays(Array.from({ length: talks }, (_, index) => index), dates)
  return { dates: planned.slots.map((slot) => slot.date), note: planned.note }
}

export function listDates(dates: string[]): string {
  const named = dates.map((date) => formatLearnerDate(date, 'week')).filter(Boolean)
  if (!named.length) return ''
  if (named.length === 1) return named[0]
  if (named.length === 2) return `${named[0]} and ${named[1]}`
  return `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`
}

/** Names the actual sitting dates, not a weekday list or a second end date. */
export function planToast(talks: number, dates: string[]) {
  const when = listDates(dates)
  if (talks === 1) return `Done. Your 1 talk is on ${when || 'your chosen day'}.`
  if (dates.length <= 4) return `Done. Your ${talks} talks are on ${when || 'your chosen days'}.`
  return `Done. Your ${talks} talks run from ${formatLearnerDate(dates[0], 'week')} to ${formatLearnerDate(dates[dates.length - 1], 'week')}.`
}

export function parseWeekdays(raw: string | string[] | undefined | null): number[] {
  const bits = Array.isArray(raw) ? raw : String(raw || '').split(/[,\s]+/)
  return [...new Set(bits.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
}

/** Keep the course, days and dates on the plan form after it is shared out, so they can be adjusted. */
export function planKeepPath(
  path: string,
  draft: { course?: number | null; start: string; end: string; weekdays: number[]; minutes: number; from?: string | null; learners?: number[] },
) {
  const safe = path.startsWith('/') && !path.startsWith('//') ? path : '/'
  const url = new URL(safe, 'https://hearts.local')
  if (draft.course) url.searchParams.set('course', String(draft.course))
  url.searchParams.set('start', draft.start)
  url.searchParams.set('end', draft.end)
  url.searchParams.set('days', draft.weekdays.join(','))
  url.searchParams.set('minutes', String(draft.minutes))
  url.searchParams.set('view', 'new')
  if (draft.from) url.searchParams.set('from', draft.from)
  if (draft.learners?.length) url.searchParams.set('learner', draft.learners.join(','))
  return `${url.pathname}${url.search}`
}

/** A teacher notice names the dates without starting with Done. */
export function planNotify(talks: number, dates: string[]) {
  const when = listDates(dates)
  if (talks === 1) return `Your teacher set 1 talk for ${when || 'your chosen day'}.`
  if (dates.length <= 4) return `Your teacher set ${talks} talks for ${when || 'your chosen days'}.`
  return `Your teacher set ${talks} talks from ${formatLearnerDate(dates[0], 'week')} to ${formatLearnerDate(dates[dates.length - 1], 'week')}.`
}

/** Talks on each sitting date, in date order: 3, 3, 2, 2. */
export function dayTalkCounts(slots: { date?: string }[]) {
  const counts: number[] = []
  let last = ''
  for (const slot of slots) {
    const date = String(slot.date || '')
    if (!date) continue
    if (date === last) counts[counts.length - 1] += 1
    else {
      counts.push(1)
      last = date
    }
  }
  return counts
}
