let overrideMs: number | null = null

export function clockEnabled() {
  return process.env.HEARTS_TEST_CLOCK === '1'
}

export function now(): Date {
  if (overrideMs != null) return new Date(overrideMs)
  if (process.env.HEARTS_NOW) {
    const parsed = new Date(process.env.HEARTS_NOW)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return new Date()
}

export function setTestNow(iso: string | null) {
  if (!clockEnabled()) {
    throw new Error('The test clock is off.')
  }
  if (!iso) {
    overrideMs = null
    return now()
  }
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) throw new Error('That time could not be read.')
  overrideMs = parsed.getTime()
  return new Date(overrideMs)
}

export function daysBetween(earlier: Date, later: Date) {
  const ms = later.getTime() - earlier.getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}
