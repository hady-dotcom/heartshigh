/** Calendar days since the learner first sat with us, counting today as day 1. */

export function daysWithUs(start: string | Date | null | undefined, nowMs = Date.now()) {
  const from = new Date(start || nowMs)
  const at = Number.isFinite(from.getTime()) ? from.getTime() : nowMs
  return Math.max(1, Math.floor((nowMs - at) / 86_400_000) + 1)
}

export function daysWithUsLabel(days: number) {
  const count = Math.max(1, Math.round(days) || 1)
  return count === 1 ? '1 day with us so far' : `${count} days with us so far`
}
