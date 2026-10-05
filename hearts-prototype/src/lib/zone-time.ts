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
