import Link from 'next/link'
import { PlanForm } from '@/components/app/plan-form'
import { PlanCalendar } from '@/components/app/plan-calendar'
import { WeekStrip } from '@/components/app/week-strip'
import { AppFrame, Back, Flash, TabBar } from '@/components/app/shell'
import { formatLearnerDate, parseWeekdays } from '@/lib/week'
import { libraryStartNote } from '@/lib/first-course'
import { minutesADay } from '@/lib/study-plan'
import { now } from '@/lib/clock'
import { dateKeyInZone } from '@/lib/week'
import { weekView } from '@/server/week-plan'
import { type Ctx, unreadCount } from '../common'

export async function WeekScreen({ payload, user, portal, base, query }: Ctx) {
  const [view, unread] = await Promise.all([weekView(payload, user, portal, base), unreadCount(payload, user)])
  const today = dateKeyInZone(now(), view.zone)
  const later = dateKeyInZone(new Date(now().getTime() + 27 * 86_400_000), view.zone)
  const latest = view.plans[0]
  const fromQuery = query.course != null && query.course !== '' ? Number(query.course) : NaN
  const selected = Number.isFinite(fromQuery) && fromQuery > 0 ? fromQuery : latest?.courseId || null
  const start = String(query.start || latest?.start || today)
  const end = String(query.end || latest?.end || later)
  const weekdays = parseWeekdays(query.days)
  const keptDays = weekdays.length ? weekdays : latest?.weekdays || []
  const minutes = minutesADay(query.minutes) || 20
  const showForm = !view.plans.length || query.course != null || query.view === 'new' || Boolean(query.notice)
  const from = String(query.from || '')
  const back = from === 'course' && selected
    ? { href: `${base}/course/${selected}`, label: 'Course' }
    : from === 'me'
      ? { href: `${base}/me`, label: 'Me' }
      : { href: `${base}/lanes`, label: 'Lanes' }
  return (
    <AppFrame testId="plan">
      <div className="app-scroll">
        <Back href={back.href} label={back.label} />
        <div className="app-head"><h1>My week</h1></div>
        <Flash error={query.error} notice={query.notice} />
        <WeekStrip days={view.days} today={view.today} href={`${base}/week`} emptyHref={`${base}/week?view=new`} compact={view.plans.length > 0} />
        {view.plans.length ? (
          <p style={{ margin: '0 0 12px' }}>
            <a className="pill outline" href="/api/hearts/week.ics" data-testid="plan-ics">Add these days to your calendar</a>
          </p>
        ) : null}
        {view.plans.map((plan, planIndex) => {
          const note = libraryStartNote(plan.slots.map((slot) => slot.title))
          return (
            <section key={plan.id} data-testid="schedule-plan" style={{ marginTop: 18 }}>
              <h2 style={{ fontSize: 19, margin: '0 0 4px' }}>{plan.name}</h2>
              <p className="muted" style={{ margin: 0, fontSize: 13 }} data-testid="plan-counts">
                {plan.slots.length} talk{plan.slots.length === 1 ? '' : 's'}
                {plan.dayCounts.length > 1 ? ` · ${plan.dayCounts.join(', ')}` : ''}
                {' · '}
                {formatLearnerDate(plan.start, 'week')} to {formatLearnerDate(plan.end, 'week')}
              </p>
              {plan.dayCounts.length > 1 ? (
                <ol className="plan-day-list" data-testid="plan-day-list">
                  {[...plan.slots.reduce((map, slot) => {
                    const own = map.get(slot.date) || []
                    own.push(slot)
                    map.set(slot.date, own)
                    return map
                  }, new Map<string, typeof plan.slots>()).entries()].map(([date, own]) => (
                    <li key={date} data-testid="plan-day">{formatLearnerDate(date, 'week')} · {own.length} talk{own.length === 1 ? '' : 's'}</li>
                  ))}
                </ol>
              ) : null}
              {planIndex === 0 ? <PlanCalendar slots={plan.slots} today={view.todayKey} /> : null}
              {plan.locked ? <p className="muted" data-testid="plan-locked">Your teacher set this plan. You can still watch at your own pace.</p> : null}
              {plan.note ? <p className="muted" data-testid="spread-note">{plan.note}</p> : null}
              {plan.overMinutes ? <p className="muted" data-testid="over-minutes">{plan.overMinutes}</p> : null}
              {note ? <p className="muted" data-testid="library-start">{note}</p> : null}
              {plan.slots.map((slot, index) => {
                const inner = (
                  <>
                    <span className="date">
                      {slot.date ? formatLearnerDate(slot.date, 'week').replace(/^(\w+) (\d+).*/, '$2') : ''}
                      <small>{slot.date ? formatLearnerDate(slot.date, 'week').replace(/^(\w+) .*/, '$1') : ''}</small>
                    </span>
                    <span className="grow">
                      {slot.title}
                      {slot.today ? <small className="today-badge" data-testid="today-badge">Today</small> : null}
                    </span>
                    {slot.href ? <span className="slot-go" aria-hidden>›</span> : null}
                  </>
                )
                return slot.href ? (
                  <Link className="slot" key={`${plan.id}-${index}`} href={slot.href} data-testid="schedule-slot" data-date={slot.date}>
                    {inner}
                  </Link>
                ) : (
                  <div className="slot" key={`${plan.id}-${index}`} data-testid="schedule-slot" data-date={slot.date}>
                    {inner}
                  </div>
                )
              })}
            </section>
          )
        })}
        <PlanForm
          key={selected || 'none'}
          courses={view.courses}
          selected={selected}
          start={start}
          end={end}
          weekdays={keptDays}
          minutes={minutes}
          next={from ? `${base}/week?from=${encodeURIComponent(from)}` : `${base}/week`}
          portalSlug={String(portal.slug || '')}
          open={showForm}
        />
      </div>
      <TabBar base={base} active="week" unread={unread} />
    </AppFrame>
  )
}
