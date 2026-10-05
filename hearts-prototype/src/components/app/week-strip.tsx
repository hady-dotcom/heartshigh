import Link from 'next/link'
import type { WeekDay } from '@/lib/week'
import type { WeekSlot } from '@/server/week-plan'
import { todayLine } from '@/server/week-plan'

export function WeekStrip({
  days,
  today,
  scheduledKeys = [],
  href,
  emptyHref,
  compact = false,
}: {
  days: WeekDay[]
  today: WeekSlot | null
  scheduledKeys?: string[]
  href: string
  emptyHref: string
  compact?: boolean
}) {
  const line = todayLine(today)
  const scheduled = new Set(scheduledKeys)
  return (
    <section className="week-strip" data-testid="week-strip">
      <div className="week-days" data-testid="week-days">
        {days.map((day) => {
          const sitting = scheduled.has(day.key)
          return (
          <span key={day.key} className={`week-day${day.today ? ' today' : ''}${sitting ? ' scheduled' : ''}`} data-testid="week-day" data-today={day.today ? 'yes' : 'no'} data-scheduled={sitting ? 'yes' : 'no'} data-key={day.key}>
            <small>{day.label}</small>
            <b>{day.day}</b>
            {sitting ? <i className="dot" data-testid="week-dot" /> : null}
          </span>
          )
        })}
      </div>
      {compact ? null : line && today?.href ? (
        <Link className="week-today" href={today.href} data-testid="week-today">
          {line}
        </Link>
      ) : (
        <Link className="week-today empty" href={emptyHref} data-testid="plan-your-week">
          Plan your week ›
        </Link>
      )}
      <Link className="sr-only" href={href} data-testid="week-strip-link">
        Open My week
      </Link>
    </section>
  )
}
