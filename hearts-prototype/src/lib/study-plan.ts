export const MINUTES_A_DAY = [10, 20, 30, 45] as const
export type MinutesADay = (typeof MINUTES_A_DAY)[number]

export function minutesADay(value: unknown): MinutesADay | null {
  const minutes = Number(value)
  return (MINUTES_A_DAY as readonly number[]).includes(minutes) ? (minutes as MinutesADay) : null
}

export type PlanSlot = { date?: string; lessonId?: number | null; title?: string }

/** The next sitting: today's if it is still open, otherwise the next one that is not finished. */
export function tonightSlot(slots: PlanSlot[], today: string, done: Set<number>) {
  const rows = slots.filter((slot) => Number(slot.lessonId))
  return (
    rows.find((slot) => (slot.date || '') >= today && !done.has(Number(slot.lessonId))) ||
    rows.find((slot) => !done.has(Number(slot.lessonId))) ||
    null
  )
}

export function tonightLabel(part: number, minutes: number) {
  return `Tonight: Part ${part}, ${minutes} min`
}

/** Continue rows: last watched first, then visits that have no watch yet. */
export function continueOrder(watched: number[], visited: number[], done: Set<number>, limit = 3) {
  const seen = new Set<number>()
  const ids: number[] = []
  for (const id of [...watched, ...visited]) {
    if (!id || done.has(id) || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
    if (ids.length >= limit) break
  }
  return ids
}

/** Calendar day in a portal's time zone, as YYYY-MM-DD. */
export function dateKeyInZone(at: Date, timeZone: string) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at)
  } catch {
    return at.toISOString().slice(0, 10)
  }
}
