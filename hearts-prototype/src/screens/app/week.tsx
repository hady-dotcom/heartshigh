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
  const selected = Number(query.course) || latest?.courseId || null
  const start = String(query.start || latest?.start || today)
  const end = String(query.end || latest?.end || later)
  const weekdays = parseWeekdays(query.days)
  const keptDays = weekdays.length ? weekdays : latest?.weekdays || []
  const minutes = minutesADay(query.minutes) || 20
  const showForm = !view.plans.length || query.course != null || query.view === 'new' || Boolean(query.notice)
  return (
    <AppFrame testId="plan">
      <div className="app-scroll">
        <Back href={`${base}/me`} label="Me" />
        <div className="app-head"><h1>My week</h1></div>
        <Flash error={query.error} notice={query.notice} />
        <WeekStrip days={view.days} today={view.today} href={`${base}/week`} emptyHref={`${base}/week?view=new`} />
        {view.today?.href ? (
          <Link className="pill gold block" href={view.today.href} data-testid="week-open-today" style={{ margin: '12px 0' }}>
            {`Today: ${view.today.title}${view.today.minutes ? ` (${view.today.minutes} min)` : ''}`}
          </Link>
        ) : null}
        {view.plans.length ? (
          <p style={{ margin: '0 0 12px' }}>
            <a className="pill outline" href="/api/hearts/week.ics" data-testid="plan-ics">Add these days to your calendar</a>
          </p>
        ) : null}
        {view.plans[0] ? <PlanCalendar slots={view.plans[0].slots} today={view.todayKey} /> : null}
        {view.plans.map((plan) => {
          const note = libraryStartNote(plan.slots.map((slot) => slot.title))
          return (
            <section key={plan.id} data-testid="schedule-plan" style={{ marginTop: 18 }}>
              <h2 style={{ fontSize: 19, margin: '0 0 4px' }}>{plan.name}</h2>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                {plan.slots.length} talk{plan.slots.length === 1 ? '' : 's'} · {formatLearnerDate(plan.start, 'week')} to {formatLearnerDate(plan.end, 'week')}
              </p>
              {plan.locked ? <p className="muted" data-testid="plan-locked">Your teacher set this plan. You can still watch at your own pace.</p> : null}
              {plan.note ? <p className="muted" data-testid="spread-note">{plan.note}</p> : null}
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
                  </>
                )
                return slot.href ? (
                  <Link className="slot" key={`${plan.id}-${index}`} href={slot.href} data-testid="schedule-slot">
                    {inner}
                  </Link>
                ) : (
                  <div className="slot" key={`${plan.id}-${index}`} data-testid="schedule-slot">
                    {inner}
                  </div>
                )
              })}
            </section>
          )
        })}
        <PlanForm
          courses={view.courses}
          selected={selected}
          start={start}
          end={end}
          weekdays={keptDays}
          minutes={minutes}
          next={`${base}/week`}
          portalSlug={String(portal.slug || '')}
          open={showForm}
        />
      </div>
      <TabBar base={base} active="week" unread={unread} />
    </AppFrame>
  )
}
