const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** "30 Sep", or "30 Sep 2026" when the year is included. UTC, so a chart and a name do not drift. */
export function humanDayMonth(when: Date, year = false) {
  const day = when.getUTCDate()
  const month = MONTHS[when.getUTCMonth()] || 'Jan'
  return year ? `${day} ${month} ${when.getUTCFullYear()}` : `${day} ${month}`
}

/** An ISO day such as 2026-09-30, shown as 30 Sep. */
export function humanDate(iso: string) {
  const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return String(iso || '')
  return humanDayMonth(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))))
}

/** A single loose film, not a playlist, lands in a course named for the day it was brought in. */
export function broughtInCourseName(when: Date) {
  return `Brought in ${humanDayMonth(when, true)}`
}
