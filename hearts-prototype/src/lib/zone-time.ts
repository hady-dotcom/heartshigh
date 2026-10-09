/** Times shown to a portal's staff: in the portal's own time zone, written the way the viewer's language writes them. */

export const DEFAULT_TIME_ZONE = 'Europe/London'

/** The zones offered in portal settings. Any valid IANA zone saved another way is still honoured. */
export const PORTAL_TIME_ZONES = [
  'Europe/London', 'Europe/Dublin', 'Europe/Paris', 'Europe/Berlin', 'Europe/Istanbul', 'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos',
  'Asia/Dubai', 'Asia/Riyadh', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Kuala_Lumpur', 'Asia/Jakarta', 'Asia/Singapore',
  'Australia/Sydney', 'Pacific/Auckland', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto', 'UTC',
] as const

export function isTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: value.trim() })
    return true
  } catch {
    return false
  }
}

export function portalTimeZone(portal: { timeZone?: unknown } | null | undefined) {
  return isTimeZone(portal?.timeZone) ? String(portal!.timeZone).trim() : DEFAULT_TIME_ZONE
}

/** The first language the browser asked for that Intl knows, else British English. */
export function localeFromAcceptLanguage(header: string | null | undefined) {
  const tags = (header || '')
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';')
      const q = Number(params.find((param) => param.trim().startsWith('q='))?.trim().slice(2) ?? 1)
      return { tag: tag.trim(), q: Number.isFinite(q) ? q : 0 }
    })
    .filter((row) => row.tag && row.tag !== '*' && row.q > 0)
    .sort((a, b) => b.q - a.q)
  for (const { tag } of tags) {
    try {
      const [supported] = Intl.DateTimeFormat.supportedLocalesOf(tag)
      if (supported) return supported
    } catch {
      // Not a language tag.
    }
  }
  return 'en-GB'
}

/** "4 Oct 2026, 06:12 BST": date, time and a short zone label, in the portal's zone and the viewer's language. */
export function zonedTime(iso: string | Date | null | undefined, timeZone: string, locale = 'en-GB') {
  const date = iso instanceof Date ? iso : new Date(String(iso || ''))
  if (Number.isNaN(date.getTime())) return ''
  const zone = isTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE
  return new Intl.DateTimeFormat(locale, { timeZone: zone, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(date)
}

/** "London" from Europe/London, for the setting's label. */
export function zoneCity(timeZone: string) {
  return timeZone === 'UTC' ? 'UTC' : timeZone.split('/').pop()!.replace(/_/g, ' ')
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** Wall-clock parts of an instant in a zone: hour 0–23, weekday 0=Sunday. */
export function partsInZone(at: Date, timeZone = DEFAULT_TIME_ZONE) {
  const zone = isTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const bag: Record<string, string> = {}
  for (const part of fmt.formatToParts(at)) {
    if (part.type !== 'literal') bag[part.type] = part.value
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    weekday: WEEKDAYS[bag.weekday] ?? 0,
  }
}

/** The UTC instant for `day` (YYYY-MM-DD) at `hour`:`minute` in `timeZone`. */
export function wallClock(day: string, hour: number, timeZone = DEFAULT_TIME_ZONE, minute = 0) {
  const [year, month, date] = String(day).split('-').map(Number)
  const h = Math.max(0, Math.min(23, Math.round(Number(hour) || 0)))
  const min = Math.max(0, Math.min(59, Math.round(Number(minute) || 0)))
  const zone = isTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE
  if (!year || !month || !date) return new Date(NaN)
  let guess = Date.UTC(year, month - 1, date, h, min, 0)
  for (let i = 0; i < 4; i++) {
    const local = partsInZone(new Date(guess), zone)
    const want = Date.UTC(year, month - 1, date, h, min)
    const got = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute)
    const delta = want - got
    if (delta === 0) break
    guess += delta
  }
  return new Date(guess)
}
