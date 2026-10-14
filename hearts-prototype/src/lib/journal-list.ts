/** Desk clocks use London time, the same zone as the rest of the desk. */
export const JOURNAL_TIME_ZONE = 'Europe/London'

export type JournalOrder = 'newest' | 'oldest'

export type JournalStamp = {
  id: string | number
  at: string
  /** Set when this list knows whether someone has replied. Leave it off when there is no reply state. */
  answered?: boolean
}

/** `Wed 14 Oct, 9:12 AM` */
export function journalWhen(iso: string | null | undefined, timeZone = JOURNAL_TIME_ZONE): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h12',
  }).formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ''
  const weekday = pick('weekday').replace(/\.$/, '')
  const month = pick('month').replace(/\.$/, '')
  const hour = pick('hour').replace(/^0(?=\d)/, '')
  const minute = pick('minute')
  const period = pick('dayPeriod').replace(/\./g, '').toUpperCase()
  if (!weekday || !hour || !minute || !period) return ''
  return `${weekday} ${pick('day')} ${month}, ${hour}:${minute} ${period}`
}

export function journalAnswered(entry: { teacherReply?: unknown; repliedAt?: unknown; doneAt?: unknown }) {
  const reply = typeof entry.teacherReply === 'string' ? entry.teacherReply.trim() : ''
  return Boolean(reply || entry.repliedAt || entry.doneAt)
}

/** Newest first by default. Equal times stay in a stable id order, and the other button reverses it. */
export function sortJournalEntries<T extends JournalStamp>(items: T[], order: JournalOrder = 'newest'): T[] {
  const stamp = (value: string) => {
    const time = Date.parse(value)
    return Number.isNaN(time) ? 0 : time
  }
  return [...items].sort((a, b) => {
    const diff = stamp(a.at) - stamp(b.at)
    const idDiff = String(a.id).localeCompare(String(b.id), 'en')
    const delta = diff || idDiff
    return order === 'oldest' ? delta : -delta
  })
}

/** Null when this list has no reply state, so the screen does not invent a count. */
export function journalUnanswered(items: { answered?: boolean }[]): number | null {
  if (!items.some((item) => typeof item.answered === 'boolean')) return null
  return items.filter((item) => item.answered === false).length
}

export function journalUnansweredLabel(count: number | null): string | null {
  if (count == null) return null
  if (count === 0) return 'All answered'
  if (count === 1) return '1 not answered yet'
  return `${count} not answered yet`
}
