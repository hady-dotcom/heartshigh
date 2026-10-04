import Link from 'next/link'
import { DoorChips } from '@/components/app/doors'
import { InstallCard } from '@/components/app/install-card'
import { redirect } from 'next/navigation'
import { Avatar } from '@/components/app/feed'
import { AppFrame, Flash, TabBar } from '@/components/app/shell'
import { PlayIcon } from '@/components/icons'
import { displayTalkTitle } from '@/lib/talk-title'
import { courseCards, dayNumber, portalName, posterFor, shownPoster } from '@/server/learner'
import { ensureMonthNote, recalibrationDueFor } from '@/server/compass'
import { learnerClips } from '@/server/opening'
import { lanesWithClips } from '@/lib/lanes'
import { plural } from '@/lib/schedule'
import { growth, Rings } from './garden'
import { HomeGather, homeGatherings } from './gather'
import { HomeLive, liveHomeBits } from './live'
import { type Ctx, ref, rows, str, unreadCount } from '../common'

function minutesLeft(seconds: number, percent: number) {
  if (!seconds) return null
  const left = Math.max(1, Math.round((seconds * (1 - percent / 100)) / 60))
  return `${left} min left`
}

/** Home: the growth banner, what to carry on with, then the way into today's clips (board 00). */
export async function HomeScreen({ payload, user, portal, base, query }: Ctx) {
  if (user.role === 'learner' && !user.onboarded) redirect(user.startingClause ? `${base}/start?after=placing` : `${base}/welcome`)
  const [g, unread, { items }, courses, due, gatherings, liveBits] = await Promise.all([growth(payload, user), unreadCount(payload, user), learnerClips(payload, portal, user), courseCards(payload, user), user.role === 'learner' ? recalibrationDueFor(payload, user.id) : Promise.resolve(false), homeGatherings({ payload, portal, user, base }), liveHomeBits({ payload, portal, user })])
  if (due) await ensureMonthNote(payload, user.id, portal.id, String(portal.slug || ''))
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
      const part = Number(lesson.order || 1)
      return {
        id: lesson.id,
        href: `${base}/course/${ref(lesson.course)}?part=${lesson.id}`,
        title: displayTalkTitle({
          title: str(lesson.title),
          sourceTitle: str(lesson.sourceTitle),
          courseTitle: str(course?.title),
          part,
          youtubeId: str(lesson.youtubeId),
          vimeoId: str(lesson.vimeoId),
        }),
        sub: minutesLeft(seconds, percent) || str(course?.title),
        thumb: shownPoster(posterFor(str(lesson.youtubeId) || null)),
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
        <HomeLive live={liveBits.live} upcoming={liveBits.upcoming} base={base} portal={String(portal.slug)} />
        <span className="sr-only">{portalName(portal)}</span>
        <Flash error={query.error} notice={query.notice} />
        <InstallCard sheet />
        <section className="grow-banner" data-testid="grow-banner">
          <p className="eyebrow">Your growth</p>
          <h2 data-testid="days-count">{days ? `${days} day${days === 1 ? '' : 's'} with us so far` : 'Your garden starts today'}</h2>
          <span className="tree-art" aria-hidden />
          <p className="grow-sub">Five ways to see it</p>
          <Rings g={g} base={base} />
          <Link className="pill gold block" href={`${base}/garden`} data-testid="see-sown">See what you&apos;ve sown</Link>
        </section>
        {due ? (
          <section className="card" data-testid="recalibrate-card" style={{ marginBottom: 16 }}>
            <h2 style={{ marginTop: 0 }}>A fresh look, when you have a moment</h2>
            <p>Five short questions, in different words, and one line about life just now.</p>
            <Link className="pill ink" href={`${base}/recalibrate`} data-testid="recalibrate-open">Take a few moments</Link>
          </section>
        ) : null}
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
              <span className="thumb" style={shownPoster(course.poster) ? { backgroundImage: `url(${shownPoster(course.poster)})` } : undefined} />
              <span className="t"><b>{course.title}</b><span className="sr-only">. </span><small>{course.speaker} · {plural(course.parts, 'part')}</small><DoorChips doors={course.doors} max={1} /></span>
            </Link>
          ))}
          {!carryOn.length && !fallback.length ? <p className="muted">Start a course from Lanes and it will wait for you here.</p> : null}
        </div>
        <HomeGather cards={gatherings} base={base} masjid={portalName(portal)} />
        <p className="eyebrow">Today&apos;s clips <span className="muted" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600 }} data-testid="day-number">· Day {dayNumber(user)}</span></p>
        <Link className="feed-door" href={`${base}/feed`} data-testid="open-feed">
          <span className="strip">
            {clips.map((clip) => (
              <span key={clip.id} className="mini" style={shownPoster(clip.poster) || shownPoster(clip.portrait) ? { backgroundImage: `url(${shownPoster(clip.poster) || shownPoster(clip.portrait)})` } : undefined} />
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

export async function LanesScreen({ payload, user, portal, base, query }: Ctx) {
  const [{ opening }, courses, unread] = await Promise.all([learnerClips(payload, portal, user), courseCards(payload, user), unreadCount(payload, user)])
  const lanes = lanesWithClips(opening.route, opening.clips, opening.laneTitles)
  const today = dayNumber(user)
  return (
    <AppFrame testId="lanes">
      <div className="app-scroll">
        <div className="app-head"><h1>Lanes</h1><span className="muted" style={{ fontSize: 13, fontWeight: 600 }} data-testid="day-number">Day {today}</span></div>
        <Flash error={query.error} notice={query.notice} />
        <p className="lead">Each lane is one theme. Tap a lane to watch its clips, or start a full course below.</p>
        {lanes.map((lane) => {
          const first = lane.clips[0]
          const count = lane.clips.length
          return (
            <Link
              key={lane.key}
              className="lane-card"
              href={`${base}/feed?lane=${lane.key}`}
              data-testid="lane-card"
              data-lane={lane.key}
              data-first-cut={first.cutId}
              style={shownPoster(first.poster) || shownPoster(first.portrait) ? { backgroundImage: `url(${shownPoster(first.poster) || shownPoster(first.portrait)})` } : undefined}
            >
              <div>
                <small>Lane</small>
                <h3>{lane.title}</h3>
                <p>{snippet(first.hook || first.land || first.lessonTitle || '', 64)}</p>
                <p>{first.speaker} · {count} {count === 1 ? 'clip' : 'clips'}</p>
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
              <span className="thumb" style={shownPoster(course.poster) ? { backgroundImage: `url(${shownPoster(course.poster)})` } : undefined} />
              <span className="t">
                <b>{course.title}</b>
                <small>
                  {course.recommended ? <span className="drip" data-testid="recommended">Chosen for you · </span> : null}
                  {course.open ? `${course.parts} part${course.parts === 1 ? '' : 's'} · ${course.speaker}` : <span className="drip" data-testid="opens-on">Opens on day {course.opensOnDay}</span>}
                </small>
                <DoorChips doors={course.doors} />
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
