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

/** Study days inside a range. `weekdays` uses JS numbering: 0 Sunday … 6 Saturday. */
export function studyDates(start: string, end: string, weekdays: number[]): string[] {
  if (!weekdays.length) throw new Error('Choose at least one day of the week.')
  const from = parseISODate(start)
  const to = parseISODate(end)
  if (to.getTime() < from.getTime()) throw new Error('The end date needs to be on or after the start.')
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
 * Spread items evenly, in order, across study days.
 * Earlier days take the remainder so the plan finishes as soon as the days allow,
 * even if the end date is later.
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

export function flattenSlots<T extends { id?: number; title?: string }>(
  slots: Slot<T>[],
): { date: string; title: string; lessonId: number | null }[] {
  const rows: { date: string; title: string; lessonId: number | null }[] = []
  for (const slot of slots) {
    for (const item of slot.items) {
      rows.push({
        date: slot.date,
        title: item.title || 'Sitting',
        lessonId: typeof item.id === 'number' ? item.id : null,
      })
    }
  }
  return rows
}
