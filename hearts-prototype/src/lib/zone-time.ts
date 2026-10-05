/** Times shown to a portal's staff: in the portal's own time zone, written the British way. */

import { dateKeyInZone as dayInZone } from './study-plan'

export const DEFAULT_TIME_ZONE = 'America/Toronto'
export { dateKeyInZone } from './study-plan'

/** The zones offered in portal settings. Any valid IANA zone saved another way is still honoured. */
export const PORTAL_TIME_ZONES = [
  'Europe/London', 'Europe/Dublin', 'Europe/Paris', 'Europe/Berlin', 'Europe/Istanbul', 'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos',
  'Asia/Dubai', 'Asia/Riyadh', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Kuala_Lumpur', 'Asia/Jakarta', 'Asia/Singapore',
  'Australia/Sydney', 'Pacific/Auckland', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto', 'UTC',
] as const

const ZONE_LETTERS: Record<string, string> = {
  'America/Toronto': 'ET',
  'America/New_York': 'ET',
  'America/Chicago': 'CT',
  'America/Denver': 'MT',
  'America/Los_Angeles': 'PT',
  UTC: 'UTC',
}

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

function asDate(iso: string | Date | null | undefined) {
  const date = iso instanceof Date ? iso : new Date(String(iso || ''))
  return Number.isNaN(date.getTime()) ? null : date
}

function zoneOf(timeZone: string) {
  return isTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE
}

/** "4 Oct 2026, 06:12 BST": date, time and a short zone label, in the portal's zone and the viewer's language. */
export function zonedTime(iso: string | Date | null | undefined, timeZone: string, locale = 'en-GB') {
  const date = asDate(iso)
  if (!date) return ''
  const zone = zoneOf(timeZone)
  const formatted = new Intl.DateTimeFormat(locale, { timeZone: zone, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(date)
  const letter = ZONE_LETTERS[zone]
  if (!letter) return formatted
  return formatted.replace(/\s(?:GMT[+\-−]\d+(?::\d+)?|UTC|EDT|EST|ET|CDT|CST|MDT|MST|PDT|PST)$/u, ` ${letter}`)
}

export function zoneLetter(timeZone: string) {
  const zone = zoneOf(timeZone)
  if (ZONE_LETTERS[zone]) return ZONE_LETTERS[zone]
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, timeZoneName: 'short', hour: '2-digit' }).formatToParts(new Date())
  return parts.find((part) => part.type === 'timeZoneName')?.value || zoneCity(zone)
}

/** "5 October 2026, 8:36 PM ET" — British date, 12-hour clock, short zone. */
export function staffWhen(iso: string | Date | null | undefined, timeZone: string) {
  const date = asDate(iso)
  if (!date) return ''
  const zone = zoneOf(timeZone)
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: zone, day: 'numeric', month: 'long', year: 'numeric' }).format(date)
  const clock = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit', hour12: true }).format(date)
  return `${day}, ${clock} ${zoneLetter(zone)}`
}

function offsetAt(date: Date, timeZone: string) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: zoneOf(timeZone), timeZoneName: 'longOffset', hour: '2-digit' })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value || 'GMT+00:00'
  const match = name.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/)
  if (!match) return '+00:00'
  return `${match[1]}${match[2].padStart(2, '0')}:${(match[3] || '00').padStart(2, '0')}`
}

/** ISO 8601 in the portal zone, with the offset — for CSV downloads. */
export function zonedIso(iso: string | Date | null | undefined, timeZone: string) {
  const date = asDate(iso)
  if (!date) return ''
  const zone = zoneOf(timeZone)
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date).map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offsetAt(date, zone)}`
}

/** Start and end of a YYYY-MM-DD calendar day in a zone, as UTC ISO strings. */
export function zonedDayRange(day: string, timeZone: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const zone = zoneOf(timeZone)
  const startGuess = new Date(`${day}T00:00:00.000Z`)
  const start = new Date(startGuess.getTime() - parseOffsetMs(offsetAt(startGuess, zone)))
  if (dayInZone(start, zone) !== day) {
    const shift = dayInZone(start, zone) < day ? 86_400_000 : -86_400_000
    start.setTime(start.getTime() + shift)
  }
  const end = new Date(start.getTime() + 86_400_000 - 1)
  return { from: start.toISOString(), to: end.toISOString() }
}

function parseOffsetMs(offset: string) {
  const match = offset.match(/([+-])(\d{2}):(\d{2})/)
  if (!match) return 0
  const minutes = Number(match[2]) * 60 + Number(match[3])
  return (match[1] === '-' ? -1 : 1) * minutes * 60_000
}

export function ymdFromParts(year?: string, month?: string, day?: string) {
  const y = Number(year)
  const m = Number(month)
  const d = Number(day)
  if (!y || !m || !d) return ''
  if (m < 1 || m > 12 || d < 1 || d > 31) return ''
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** "18 October 2026, 21:30", or "5 October 2026 at 00:16" when join is "at". */
export function britishPortalTime(iso: string | Date | null | undefined, timeZone: string, join: 'comma' | 'at' = 'comma') {
  const date = iso instanceof Date ? iso : new Date(String(iso || ''))
  if (Number.isNaN(date.getTime())) return ''
  const zone = isTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ''
  const day = value('day')
  const month = value('month')
  const year = value('year')
  const hour = value('hour')
  const minute = value('minute')
  if (!day || !month || !year || !hour || !minute) return ''
  const glue = join === 'at' ? ' at ' : ', '
  return `${day} ${month} ${year}${glue}${hour}:${minute}`
}

/** "London" from Europe/London, for the setting's label. */
export function zoneCity(timeZone: string) {
  return timeZone === 'UTC' ? 'UTC' : timeZone.split('/').pop()!.replace(/_/g, ' ')
}
