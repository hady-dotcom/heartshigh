import Link from 'next/link'
import { formatLearnerDate } from '@/lib/week'

const LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function monthKey(iso: string) {
  return iso.slice(0, 7)
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Monday-first month grid. Scheduled days link to that talk. */
export function PlanCalendar({
  slots,
  today,
}: {
  slots: { date: string; title: string; href: string | null }[]
  today: string
}) {
  const focus = slots[0]?.date || today
  const year = Number(focus.slice(0, 4))
  const month = Number(focus.slice(5, 7))
  const first = new Date(Date.UTC(year, month - 1, 1))
  const pad = (first.getUTCDay() + 6) % 7
  const last = daysInMonth(year, month)
  const byDay = new Map<string, { date: string; title: string; href: string | null }>()
  for (const slot of slots) {
    if (monthKey(slot.date) === monthKey(focus) && !byDay.has(slot.date)) byDay.set(slot.date, slot)
  }
  const cells: (number | null)[] = [...Array.from({ length: pad }, () => null), ...Array.from({ length: last }, (_, index) => index + 1)]
  while (cells.length % 7) cells.push(null)
  const title = formatLearnerDate(`${focus.slice(0, 8)}01`, 'long').replace(/^\d+ /, '')
  return (
    <section className="plan-cal" data-testid="plan-calendar">
      <p className="eyebrow">{title}</p>
      <div className="plan-cal-grid">
        {LABELS.map((label) => (
          <span key={label} className="plan-cal-label">{label}</span>
        ))}
        {cells.map((day, index) => {
          if (!day) return <span key={`e-${index}`} className="plan-cal-day empty" />
          const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const slot = byDay.get(key)
          const on = key === today
          const inner = (
            <>
              <b>{day}</b>
              {slot ? <i /> : null}
            </>
          )
          if (slot?.href) {
            return (
              <Link key={key} href={slot.href} className={`plan-cal-day on${on ? ' today' : ''}`} title={slot.title} data-testid="plan-cal-day">
                {inner}
              </Link>
            )
          }
          return (
            <span key={key} className={`plan-cal-day${on ? ' today' : ''}${slot ? ' on' : ''}`} data-testid={slot ? 'plan-cal-day' : undefined}>
              {inner}
            </span>
          )
        })}
      </div>
    </section>
  )
}
