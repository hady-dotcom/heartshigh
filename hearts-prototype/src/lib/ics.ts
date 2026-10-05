function stamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function fold(line: string) {
  return line.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

export function eventIcs(args: {
  title: string
  startsAt: Date
  minutes?: number
  description?: string
  url?: string
  uid?: string
}) {
  const end = new Date(args.startsAt.getTime() + (args.minutes || 60) * 60_000)
  const uid = args.uid || `hearts-${args.startsAt.getTime()}@hearts`
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HEARTS//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(args.startsAt)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${fold(args.title)}`,
    args.description ? `DESCRIPTION:${fold(args.description)}` : '',
    args.url ? `URL:${args.url}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ]
    .filter((line) => line !== '')
    .join('\r\n')
}
