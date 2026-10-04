import { formatLearnerDate } from '@/lib/week'

export type IcsSlot = { date: string; title: string; href?: string | null }

function stamp(iso: string) {
  return iso.replace(/-/g, '')
}

function fold(line: string) {
  return line.replace(/[,;\\]/g, (char) => `\\${char}`).replace(/\n/g, '\\n')
}

/** A VCALENDAR for a study plan. Each sitting is an all-day event on its scheduled date. */
export function planIcs(input: { name: string; slots: IcsSlot[]; zone?: string }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HEARTS//Study plan//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${fold(input.name || 'My week')}`,
  ]
  if (input.zone) lines.push(`X-WR-TIMEZONE:${input.zone}`)
  for (const [index, slot] of input.slots.entries()) {
    if (!slot.date) continue
    const day = stamp(slot.date)
    lines.push(
      'BEGIN:VEVENT',
      `UID:hearts-plan-${day}-${index}@hearts`,
      `DTSTAMP:${day}T090000Z`,
      `DTSTART;VALUE=DATE:${day}`,
      `SUMMARY:${fold(slot.title || 'Talk')}`,
      `DESCRIPTION:${fold(`${slot.title || 'Talk'}. ${formatLearnerDate(slot.date, 'long')}.`)}`,
    )
    if (slot.href) lines.push(`URL:${slot.href}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}
