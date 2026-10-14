// The override lives on globalThis so every route bundle in one server process reads the same clock.
const store = globalThis as typeof globalThis & { __heartsClockMs?: number | null }

/** The test clock is for development and the test suite only: never in a production build. */
export function clockEnabled() {
  return process.env.HEARTS_TEST_CLOCK === '1' && process.env.NODE_ENV !== 'production'
}

export function now(): Date {
  if (store.__heartsClockMs != null && clockEnabled()) return new Date(store.__heartsClockMs)
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
    store.__heartsClockMs = null
    return now()
  }
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) throw new Error('That time could not be read.')
  store.__heartsClockMs = parsed.getTime()
  return new Date(parsed.getTime())
}

export function daysBetween(earlier: Date, later: Date) {
  const ms = later.getTime() - earlier.getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}
