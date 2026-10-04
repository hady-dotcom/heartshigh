import { now } from '@/lib/clock'
import { tidyTalkTitle } from '@/lib/talk-title'
import { formatLearnerDate } from '@/lib/week'

export type IcsSlot = { date: string; title: string; href?: string | null }

function stamp(iso: string) {
  return iso.replace(/-/g, '')
}

function icsNow(at = now()) {
  return at.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** RFC 5545 §3.1: fold at 75 octets, with a CRLF and a space on the next line. */
export function foldIcsLine(line: string) {
  const bytes = Buffer.from(line, 'utf8')
  if (bytes.length <= 75) return line
  const parts: string[] = []
  let start = 0
  let limit = 75
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length)
    while (end > start && (bytes[end] & 0xc0) === 0x80) end -= 1
    if (end === start) end = Math.min(start + limit, bytes.length)
    parts.push(bytes.slice(start, end).toString('utf8'))
    start = end
    limit = 74
  }
  return parts.join('\r\n ')
}

function absoluteHref(href: string | null | undefined, origin?: string) {
  const link = (href || '').trim()
  if (!link) return ''
  if (/^https?:\/\//i.test(link)) return link
  const host = (origin || '').replace(/\/$/, '')
  if (!host) return link
  return `${host}${link.startsWith('/') ? '' : '/'}${link}`
}

/** A VCALENDAR for a study plan. Each sitting is an all-day event on its scheduled date. */
export function planIcs(input: { name: string; slots: IcsSlot[]; zone?: string; origin?: string; stampedAt?: Date }) {
  const stamped = icsNow(input.stampedAt)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HEARTS//Study plan//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldIcsLine(`X-WR-CALNAME:${escapeIcs(input.name || 'My week')}`),
  ]
  if (input.zone) lines.push(foldIcsLine(`X-WR-TIMEZONE:${escapeIcs(input.zone)}`))
  for (const [index, slot] of input.slots.entries()) {
    if (!slot.date) continue
    const day = stamp(slot.date)
    const title = tidyTalkTitle(slot.title || 'Talk')
    const href = absoluteHref(slot.href, input.origin)
    lines.push(
      'BEGIN:VEVENT',
      `UID:hearts-plan-${day}-${index}@hearts`,
      `DTSTAMP:${stamped}`,
      `DTSTART;VALUE=DATE:${day}`,
      foldIcsLine(`SUMMARY:${escapeIcs(title)}`),
      foldIcsLine(`DESCRIPTION:${escapeIcs(`${title}. ${formatLearnerDate(slot.date, 'long')}.`)}`),
    )
    if (href) lines.push(foldIcsLine(`URL:${href}`))
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}
