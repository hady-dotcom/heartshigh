export type Slot<T> = { date: string; items: T[] }

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function weekdayName(jsDay: number) {
  return DAY_NAMES[jsDay] || ''
}

function parseISODate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) throw new Error('Use a date like 2026-10-07.')
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (Number.isNaN(date.getTime())) throw new Error('That date could not be read.')
  return date
}

export function toISODate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export const MAX_RANGE_DAYS = 366

/** "1 sitting", "3 sittings". */
export function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`
}

/** Meteorological seasons for the UK: winter is December to February. */
export function seasonName(date: Date) {
  const month = date.getUTCMonth()
  return month === 11 || month <= 1 ? 'Winter' : month <= 4 ? 'Spring' : month <= 7 ? 'Summer' : 'Autumn'
}

export function defaultPlanName(date: Date) {
  return `${seasonName(date)} study days`
}

/** Study days inside a range. `weekdays` uses JS numbering: 0 Sunday … 6 Saturday. */
export function studyDates(start: string, end: string, weekdays: number[]): string[] {
  if (!weekdays.length) throw new Error('Choose at least one day of the week.')
  const from = parseISODate(start)
  const to = parseISODate(end)
  if (to.getTime() < from.getTime()) throw new Error('The end date needs to be on or after the start.')
  if ((to.getTime() - from.getTime()) / 86_400_000 + 1 > MAX_RANGE_DAYS) throw new Error(`Keep a plan to a year or less (${MAX_RANGE_DAYS} days). Make another plan for the year after.`)
  const wanted = new Set(weekdays)
  const dates: string[] = []
  for (let cursor = from.getTime(); cursor <= to.getTime(); cursor += 86_400_000) {
    const day = new Date(cursor)
    if (wanted.has(day.getUTCDay())) dates.push(toISODate(day))
  }
  if (!dates.length) {
    throw new Error('None of those weekdays fall inside this date range.')
  }
  return dates
}

/**
 * Balanced, order-preserving split when there are at least as many talks as study days.
 * base = floor(V/D); the first V mod D days get one extra. Never the old front-loaded chunk.
 */
export function splitEvenly<T>(items: T[], dates: string[]): Slot<T>[] {
  if (!dates.length) throw new Error('There are no study days to split across.')
  if (!items.length) return dates.map((date) => ({ date, items: [] }))
  const base = Math.floor(items.length / dates.length)
  const extra = items.length % dates.length
  const slots: Slot<T>[] = []
  let index = 0
  dates.forEach((date, dayIndex) => {
    const count = base + (dayIndex < extra ? 1 : 0)
    slots.push({ date, items: items.slice(index, index + count) })
    index += count
  })
  return slots
}

function consecutiveDates(dates: string[]) {
  const unique = [...new Set(dates.filter(Boolean))].sort()
  if (unique.length < 2) return unique.length === 1
  const first = Date.parse(`${unique[0]}T12:00:00Z`)
  const last = Date.parse(`${unique[unique.length - 1]}T12:00:00Z`)
  if (!Number.isFinite(first) || !Number.isFinite(last)) return false
  const span = Math.round((last - first) / 86_400_000) + 1
  return span <= unique.length
}

export function spreadNote(talks: number, studyDays: number, slotDates: string[] = []) {
  if (talks === 1 && studyDays > 1) return 'This course has 1 talk, so it fits in one day.'
  if (talks > 1 && talks < studyDays) {
    if (slotDates.length && !consecutiveDates(slotDates)) {
      return `This course has ${talks} talks and ${studyDays} study days. The talks land on the first ${talks} days you picked.`
    }
    return `This course has ${talks} talks and ${studyDays} study days. The talks are spaced across the span. You could pick fewer days, or add more talks.`
  }
  return null
}

/** Indices for V talks across D days: 3 over 12 lands on days 1, 5 and 9 (0, 4, 8). */
export function spreadIndices(talks: number, days: number) {
  if (talks <= 0 || days <= 0) return []
  if (talks === 1) return [0]
  if (talks >= days) return Array.from({ length: days }, (_, index) => index)
  return Array.from({ length: talks }, (_, index) => Math.floor((index * days) / talks))
}

/**
 * Place talks on the chosen study days: one date for a single sitting, an even spread when
 * there are fewer talks than days, and a balanced split when there are more talks than days.
 */
export function planAcrossDays<T>(items: T[], dates: string[]): { slots: Slot<T>[]; note: string | null } {
  if (!dates.length) throw new Error('There are no study days to split across.')
  if (!items.length) return { slots: [], note: null }
  const note = spreadNote(items.length, dates.length, dates)
  if (items.length < dates.length) {
    const at = consecutiveDates(dates) ? spreadIndices(items.length, dates.length) : items.map((_, index) => index)
    return { slots: items.map((item, index) => ({ date: dates[at[index]] || dates[0], items: [item] })), note }
  }
  return { slots: splitEvenly(items, dates).filter((slot) => slot.items.length), note }
}

/** A talk longer than the chosen sitting length: warn, do not silently crush it into the day. */
export function overMinutesNote(talkMinutes: number[], minutesPerDay: number) {
  const long = talkMinutes.filter((value) => value > minutesPerDay)
  if (!long.length || minutesPerDay <= 0) return null
  const longest = Math.max(...long)
  if (long.length === 1) {
    return `This talk is about ${longest} minutes and your day is set to ${minutesPerDay} minutes. Sit with it in one go, or split it across two days.`
  }
  return `${long.length} talks are longer than the ${minutesPerDay} minutes you set for a day. Sit with each in one go, or split the longest ones.`
}

export function flattenSlots<T extends { id?: number; title?: string; courseId?: number | null }>(
  slots: Slot<T>[],
): { date: string; title: string; lessonId: number | null; courseId: number | null }[] {
  const rows: { date: string; title: string; lessonId: number | null; courseId: number | null }[] = []
  for (const slot of slots) {
    for (const item of slot.items) {
      rows.push({
        date: slot.date,
        title: item.title || 'Sitting',
        lessonId: typeof item.id === 'number' ? item.id : null,
        courseId: typeof item.courseId === 'number' ? item.courseId : null,
      })
    }
  }
  return rows
}
