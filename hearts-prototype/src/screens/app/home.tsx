import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Avatar } from '@/components/app/feed'
import { AppFrame, Flash, TabBar } from '@/components/app/shell'
import { PlayIcon } from '@/components/icons'
import { courseCards, dayNumber, loadFeed, portalName, portraitFor, posterFor, slugify } from '@/server/learner'
import { plural } from '@/lib/schedule'
import { growth, Rings } from './garden'
import { type Ctx, ref, rows, str, unreadCount } from '../common'

function minutesLeft(seconds: number, percent: number) {
  if (!seconds) return null
  const left = Math.max(1, Math.round((seconds * (1 - percent / 100)) / 60))
  return `${left} min left`
}

/** Home: the growth banner, what to carry on with, then the way into today's clips (board 00). */
export async function HomeScreen({ payload, user, portal, base, query }: Ctx) {
  if (user.role === 'learner' && !user.onboarded) redirect(`${base}/start`)
  const [g, unread, items, courses] = await Promise.all([growth(payload, user), unreadCount(payload, user), loadFeed(payload, user), courseCards(payload, user)])
  const [visits, sessions] = await Promise.all([
    rows(payload, 'lesson-visits', { user: { equals: user.id } }, { sort: '-updatedAt', limit: 40 }),
    rows(payload, 'watch-sessions', { user: { equals: user.id } }, { sort: '-updatedAt', limit: 80 }),
  ])
  const done = new Set(g.completions.filter((row) => Number(row.percent ?? 100) >= 90).map((row) => ref(row.lesson)))
  const openIds = [...new Set(visits.map((row) => ref(row.lesson)).filter((id): id is number => Boolean(id) && !done.has(id)))].slice(0, 3)
  const openLessons = openIds.length ? await rows(payload, 'lessons', { id: { in: openIds } }) : []
  const courseIds = [...new Set(openLessons.map((row) => ref(row.course)).filter((id): id is number => Boolean(id)))]
  const openCourses = courseIds.length ? await rows(payload, 'courses', { id: { in: courseIds } }) : []
  const carryOn = openIds
    .map((id) => openLessons.find((row) => row.id === id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .map((lesson) => {
      const course = openCourses.find((row) => row.id === ref(lesson.course))
      const progress = sessions.find((row) => ref(row.lesson) === lesson.id)
      const seconds = Number(lesson.durationSeconds || 0)
      const percent = seconds && progress ? Math.min(100, (Number(progress.seconds || 0) / seconds) * 100) : Number(g.completions.find((row) => ref(row.lesson) === lesson.id)?.percent || 0)
      return {
        id: lesson.id,
        href: `${base}/course/${ref(lesson.course)}?part=${lesson.id}`,
        title: `Part ${Number(lesson.order || 1)} · ${str(lesson.title)}`,
        sub: minutesLeft(seconds, percent) || str(course?.title),
        thumb: posterFor(str(lesson.youtubeId) || null) || portraitFor(slugify(str(lesson.speaker))),
      }
    })
  const fallback = carryOn.length ? [] : courses.filter((course) => course.open).slice(0, 2)
  const days = g.activeDays.size
  const clips = items.slice(0, 3)
  return (
    <AppFrame testId="home">
      <div className="app-scroll">
        <div className="app-head">
          <h1>Home</h1>
          <Link href={`${base}/me`} aria-label="Me" data-testid="home-avatar"><Avatar name={user.name || 'You'} portrait={null} size={40} /></Link>
        </div>
        <span className="sr-only">{portalName(portal)}</span>
        <Flash error={query.error} notice={query.notice} />
        <section className="grow-banner" data-testid="grow-banner">
          <p className="eyebrow">Your growth</p>
          <h2 data-testid="days-count">{days ? `${days} day${days === 1 ? '' : 's'} with us so far` : 'Your garden starts today'}</h2>
          <span className="tree-art"><img src="/brand/hoopoe-perched.png" alt="" /></span>
          <p className="grow-sub">Five ways to see it</p>
          <Rings g={g} base={base} />
          <Link className="pill gold block" href={`${base}/garden`} data-testid="see-sown">See what you&apos;ve sown</Link>
        </section>
        <p className="eyebrow">Continue</p>
        <div data-testid="continue">
          {carryOn.map((row) => (
            <Link key={row.id} className="continue-row" href={row.href} data-testid="continue-row">
              <span className="thumb" style={row.thumb ? { backgroundImage: `url(${row.thumb})` } : undefined} />
              <span className="t"><b>{row.title}</b><span className="sr-only">. </span><small>{row.sub}</small></span>
            </Link>
          ))}
          {fallback.map((course) => (
            <Link key={course.id} className="continue-row" href={`${base}/course/${course.id}`} data-testid="continue-row">
              <span className="thumb" style={course.poster ? { backgroundImage: `url(${course.poster})` } : undefined} />
              <span className="t"><b>{course.title}</b><span className="sr-only">. </span><small>{course.speaker} · {plural(course.parts, 'part')}</small></span>
            </Link>
          ))}
          {!carryOn.length && !fallback.length ? <p className="muted">Start a course from Lanes and it will wait for you here.</p> : null}
        </div>
        <p className="eyebrow">Today&apos;s clips <span className="muted" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600 }} data-testid="day-number">· Day {dayNumber(user)}</span></p>
        <Link className="feed-door" href={`${base}/feed`} data-testid="open-feed">
          <span className="strip">
            {clips.map((clip) => (
              <span key={clip.id} className="mini" style={clip.poster || clip.portrait ? { backgroundImage: `url(${clip.poster || clip.portrait})` } : undefined} />
            ))}
          </span>
          <span className="go"><PlayIcon size={22} /> Watch today&apos;s clips</span>
        </Link>
      </div>
      <TabBar base={base} active="home" unread={unread} />
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
              href={`${base}/feed?lane=${item.lane}`}
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
