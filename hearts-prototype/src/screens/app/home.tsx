import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Feed } from '@/components/app/feed'
import { AppFrame, Flash, TabBar } from '@/components/app/shell'
import { courseCards, dayNumber, loadFeed, portalName } from '@/server/learner'
import { type Ctx, unreadCount } from '../common'

export async function HomeScreen({ payload, user, portal, base, query }: Ctx) {
  if (user.role === 'learner' && !user.onboarded) redirect(`${base}/welcome`)
  const [items, unread] = await Promise.all([loadFeed(payload, user), unreadCount(payload, user)])
  return (
    <AppFrame dark testId="home">
      <h1 className="sr-only">{portalName(portal)}</h1>
      <Flash error={query.error} notice={query.notice} />
      <Feed items={items} base={base} startLane={query.lane} />
      <TabBar base={base} active="home" dark unread={unread} />
    </AppFrame>
  )
}

const START = ['orange', 'gold', 'teal']

function snippet(text: string, max: number) {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, '')}…`
}

export async function LanesScreen({ payload, user, base, query }: Ctx) {
  const [items, courses, unread] = await Promise.all([loadFeed(payload, user), courseCards(payload, user), unreadCount(payload, user)])
  const lanes = [...new Map(items.map((item) => [item.lane, item])).values()]
  const today = dayNumber(user)
  return (
    <AppFrame testId="lanes">
      <div className="app-scroll">
        <div className="app-head"><h1>Lanes</h1><span className="muted" style={{ fontSize: 13, fontWeight: 600 }} data-testid="day-number">Day {today}</span></div>
        <Flash error={query.error} notice={query.notice} />
        <p className="lead">Each lane is one theme. Tap a lane to watch its clips, or start a full course below.</p>
        {lanes.map((item) => {
          const count = items.filter((row) => row.lane === item.lane).length
          return (
            <Link
              key={item.lane}
              className="lane-card"
              href={`${base}?lane=${item.lane}`}
              data-testid="lane-card"
              style={item.poster || item.portrait ? { backgroundImage: `url(${item.poster || item.portrait})` } : undefined}
            >
              <div>
                <small>Lane</small>
                <h3>{item.laneLabel}</h3>
                <p>{snippet(item.land, 64)}</p>
                <p>{item.speaker} · {count} {count === 1 ? 'clip' : 'clips'}</p>
              </div>
            </Link>
          )
        })}
        {!lanes.length ? <p className="card" data-testid="lanes-empty"><span>No clips have been approved yet. The courses below are ready to watch.</span></p> : null}
        <p className="eyebrow">Your courses</p>
        {courses.map((course, index) => {
          const href = `${base}/course/${course.id}`
          return (
            <div key={course.id} className="course-row" data-testid="path-course" data-open={course.open ? 'yes' : 'no'}>
              <span className="thumb" style={course.poster ? { backgroundImage: `url(${course.poster})` } : undefined} />
              <span className="t">
                <b>{course.title}</b>
                <small>
                  {course.recommended ? <span className="drip" data-testid="recommended">Chosen for you · </span> : null}
                  {course.open ? `${course.parts} part${course.parts === 1 ? '' : 's'} · ${course.speaker}` : <span className="drip" data-testid="opens-on">Opens on day {course.opensOnDay}</span>}
                </small>
              </span>
              {course.open ? (
                <Link className={`start ${START[index % START.length]}`} href={href} data-testid="lesson-link">Start</Link>
              ) : (
                <Link className="start soft" href={href} data-testid="peek">Peek now</Link>
              )}
            </div>
          )
        })}
        {!courses.length ? <p className="muted" data-testid="no-courses">Your access code does not include any courses yet. Ask your teacher.</p> : null}
        <p className="muted" style={{ fontSize: 13, marginTop: 14 }} data-testid="visible-courses">
          {courses.length} course{courses.length === 1 ? '' : 's'} open to you. A new one opens each day, and you can always peek ahead.
        </p>
      </div>
      <TabBar base={base} active="lanes" unread={unread} />
    </AppFrame>
  )
}
