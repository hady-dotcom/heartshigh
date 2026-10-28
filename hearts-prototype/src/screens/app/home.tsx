import Link from 'next/link'
import { DoorChips } from '@/components/app/doors'
import { InstallCard } from '@/components/app/install-card'
import { redirect } from 'next/navigation'
import { Avatar } from '@/components/app/feed'
import { SavedCount, SavedToast } from '@/components/app/saved-list'
import { AppFrame, Flash } from '@/components/app/shell'
import { filmCanPlay } from '@/lib/film-availability'
import { appNameOf, learnerBrand } from '@/lib/learner-brand'
import { LearnerTabBar } from '@/components/app/learner-bar'
import { WeekStrip } from '@/components/app/week-strip'
import { weekView } from '@/server/week-plan'
import { PlayIcon } from '@/components/icons'
import { displayTalkTitle, tidyTalkTitle } from '@/lib/talk-title'
import { daysWithUsLabel } from '@/lib/days-with-us'
import { learnerWords } from '@/lib/tidy-caption'
import { asLessonVisibility, learnerLessonVisible } from '@/lib/publish-state'
import { courseCards, dayNumber, filmPoster, portalName, shownPoster } from '@/server/learner'
import { appleLookOnServer, artStyle } from '@/server/swatch'
import { coverColor, coverLine, coverPath } from '@/lib/cover-art'
import { visibleCourseIds } from '@/server/context'
import { ensureMonthNote, recalibrationDueFor } from '@/server/compass'
import { learnerClips } from '@/server/opening'
import { LaneProgressSlot } from '@/components/app/lane-progress'
import { laneCardSpeaker, lanesWithClips } from '@/lib/lanes'
import { getLaneProgress, lanePagePath, lanePlayPath } from '@/lib/lane-progress'
import { LANE_BLURBS } from '@/lib/opening-data'
import { watchFor } from './lane'
import { plural } from '@/lib/schedule'
import { continueOrder, dateKeyInZone, tonightLabel, tonightSlot } from '@/lib/study-plan'
import { now as clockNow } from '@/lib/clock'
import { growth, Rings } from './garden'
import { HomeGather, homeGatherings } from './gather'
import { HomeLive, liveHomeBits } from './live'
import { activeMissionCard } from './mission'
import { featureOn } from '@/lib/features'
import { shellOf } from '@/lib/portal-look'
import { FilmFallback } from '@/components/app/film-fallback'
import { sortParts } from '@/lib/part-order'
import { FilmChips, nextCourseFilms } from './course-home'
import { openAnnouncements } from '@/server/safety'
import { AnnounceCard } from '@/components/app/announce-card'
import { DemoFrameTools } from '@/components/demo/frame-tools'
import { portalOwnsLibrary } from '@/server/portal-scope'
import { type Ctx, ref, rows, str, unreadCount } from '../common'

function minutesLeft(seconds: number, percent: number) {
  if (!seconds) return null
  const left = Math.max(1, Math.round((seconds * (1 - percent / 100)) / 60))
  return `${left} min left`
}

/** Home: the growth banner, what to carry on with, then the way into today's clips (board 00). */
export async function HomeScreen({ payload, user, portal, base, query, demo }: Ctx) {
  if (user.role === 'learner' && !user.onboarded) {
    const started = await rows(payload, 'lesson-visits', { user: { equals: user.id } }, { limit: 1 })
    const taps = started.length ? [] : await rows(payload, 'opening-answers', { user: { equals: user.id } }, { limit: 1 })
    if (!started.length && !taps.length) redirect(user.startingClause ? `${base}/start?after=placing` : `${base}/welcome`)
  }
  const [g, unread, { items }, courses, due, gatherings, liveBits, week] = await Promise.all([
    growth(payload, user),
    unreadCount(payload, user),
    learnerClips(payload, portal, user),
    courseCards(payload, user, portal.id),
    user.role === 'learner' && featureOn(portal, 'compass') ? recalibrationDueFor(payload, user.id) : Promise.resolve(false),
    featureOn(portal, 'gather') ? homeGatherings({ payload, portal, user, base }) : Promise.resolve([]),
    featureOn(portal, 'live') ? liveHomeBits({ payload, portal, user }) : Promise.resolve({ live: null, upcoming: [] }),
    weekView(payload, user, portal, base),
  ])
  if (due) await ensureMonthNote(payload, user.id, portal.id, String(portal.slug || ''))
  const [visits, sessions] = await Promise.all([
    rows(payload, 'lesson-visits', { user: { equals: user.id } }, { sort: '-updatedAt', limit: 40 }),
    rows(payload, 'watch-sessions', { user: { equals: user.id } }, { sort: '-updatedAt', limit: 80 }),
  ])
  const done = new Set(g.completions.filter((row) => Number(row.percent ?? 100) >= 90).map((row) => ref(row.lesson)).filter((id): id is number => Boolean(id)))
  const openIds = continueOrder(
    sessions.map((row) => ref(row.lesson)).filter((id): id is number => Boolean(id)),
    visits.map((row) => ref(row.lesson)).filter((id): id is number => Boolean(id)),
    done,
  )
  const allowedCourses = new Set(await visibleCourseIds(payload, user, portal.id))
  const openLessons = (openIds.length ? await rows(payload, 'lessons', { id: { in: openIds } }) : []).filter((lesson) => learnerLessonVisible(asLessonVisibility(lesson)) && allowedCourses.has(ref(lesson.course) || 0))
  const courseIds = [...new Set(openLessons.map((row) => ref(row.course)).filter((id): id is number => Boolean(id)))]
  const openCourses = courseIds.length ? await rows(payload, 'courses', { id: { in: courseIds } }) : []
  const modernHome = shellOf(portal) === 'modern'
  const siblingRows = modernHome && courseIds.length
    ? await rows(payload, 'lessons', { course: { in: courseIds } }, { sort: 'order', limit: 500 })
    : []
  const placeOf = new Map<number, number>()
  for (const courseId of courseIds) {
    const own = sortParts(siblingRows.filter((lesson) => ref(lesson.course) === courseId && learnerLessonVisible(asLessonVisibility(lesson))), () => 0)
    own.forEach((lesson, index) => placeOf.set(lesson.id, index + 1))
  }
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
        title: learnerWords(displayTalkTitle({
          title: str(lesson.title),
          sourceTitle: str(lesson.sourceTitle),
          courseTitle: str(course?.title),
          part,
          youtubeId: str(lesson.youtubeId),
          vimeoId: str(lesson.vimeoId),
        })),
        sub: minutesLeft(seconds, percent) || tidyTalkTitle(str(course?.title)),
        thumb: shownPoster(filmPoster(lesson)),
        percent: Math.round(percent),
        place: placeOf.get(lesson.id) || part,
      }
    })
  const fallback = carryOn.length ? [] : courses.filter((course) => course.open).slice(0, 2)
  const fallbackLessons = fallback.length
    ? await rows(payload, 'lessons', { course: { in: fallback.map((course) => course.id) } }, { limit: 400 })
    : []
  const plans = await rows(payload, 'schedules', { portal: { equals: portal.id } }, { sort: '-createdAt', limit: 20 })
  const plan = plans.find((row) => ref(row.owner) === user.id || ((row.learners as unknown[]) || []).some((item) => ref(item) === user.id))
  const slot = plan ? tonightSlot((plan.slots as { date?: string; lessonId?: number | null; title?: string }[]) || [], dateKeyInZone(clockNow(), portal.timeZone || 'Europe/London'), done) : null
  const planRow = slot?.lessonId ? (await rows(payload, 'lessons', { id: { equals: slot.lessonId } }, { limit: 1 }))[0] : null
  const planLesson = planRow && learnerLessonVisible(asLessonVisibility(planRow)) ? planRow : null
  const talkMinutes = Math.max(1, Math.round(Number(planLesson?.durationSeconds || 0) / 60))
  const tonight = planLesson
    ? { label: tonightLabel(Number(planLesson.order || 1), talkMinutes), href: `${base}/course/${ref(planLesson.course)}?part=${planLesson.id}`, title: learnerWords(displayTalkTitle({ title: str(planLesson.title), sourceTitle: str(planLesson.sourceTitle), courseTitle: '', part: Number(planLesson.order || 1), youtubeId: str(planLesson.youtubeId), vimeoId: str(planLesson.vimeoId) })) }
    : null
  const days = dayNumber(user)
  const ownLibrary = await portalOwnsLibrary(payload, portal.id)
  const clips = items.slice(0, 3)
  const nextFilms = clips.length ? [] : await nextCourseFilms(payload, user, base, 4, portal.id)
  const notes = featureOn(portal, 'announcements') ? await openAnnouncements(payload, user, portal.id) : []
  const tint = await appleLookOnServer()
  let demoContinue = ''
  if (demo) {
    const local = await rows(payload, 'courses', { and: [{ origin: { equals: 'local' } }, { portal: { equals: portal.id } }, { hidden: { not_equals: true } }] }, { limit: 1 })
    const ordered = local[0] ? await rows(payload, 'lessons', { course: { equals: local[0].id } }, { sort: 'order', limit: 30 }) : []
    const firstLesson = ordered.find((row) => filmCanPlay({ vimeoId: str(row.vimeoId), youtubeId: str(row.youtubeId), videoProvider: str(row.videoProvider) })) || ordered[0] || null
    if (local[0] && firstLesson) demoContinue = `${base}/course/${local[0].id}?part=${firstLesson.id}`
  }
  return (
    <AppFrame testId="home" brand={learnerBrand(portal)} art={tint && carryOn[0] ? coverColor(Number(carryOn[0].href.match(/\/course\/(\d+)/)?.[1] || 0), carryOn[0].id) : null}>
      <div className="app-scroll">
        <div className="app-head">
          <h1>Home</h1>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SavedCount base={base} />
            <Link href={`${base}/me`} aria-label="Me" data-testid="home-avatar"><Avatar name={user.name || 'You'} portrait={null} size={40} /></Link>
          </span>
        </div>
        {featureOn(portal, 'live') ? <HomeLive live={liveBits.live} upcoming={liveBits.upcoming} base={base} portal={String(portal.slug)} /> : null}
        <SavedToast />
        <span className="sr-only">{portalName(portal)}</span>
        <Flash error={query.error} notice={query.notice} />
        {demo ? <DemoFrameTools token={demo.token} role={demo.role} cast={demo.cast} seq={demo.state.seq} /> : null}
        {demo ? <p data-testid="demo-hello">Hello {demo.cast.learner}</p> : null}
        {demo && demo.state.features.notes && demo.state.notes[0] ? <p className="card" data-testid="demo-note">{demo.state.notes[0].from}: {demo.state.notes[0].body}</p> : null}
        {demo && demo.state.features.plan ? <p className="card" data-testid="demo-plan">This week: watch one film.</p> : null}
        {demo && demoContinue ? <a className="pill gold block" href={demoContinue} data-testid="sequence-continue">Continue</a> : null}
        {notes.map((note) => (
          <AnnounceCard key={note.id} id={note.id} body={str(note.body)} next={base} />
        ))}
        {featureOn(portal, 'garden') && shellOf(portal) === 'hearts' ? (
        <section className="grow-banner" data-testid="grow-banner">
          <p className="eyebrow">Your growth</p>
          <h2 data-testid="days-count">{daysWithUsLabel(days)}</h2>
          <span className="tree-art" aria-hidden />
          <p className="grow-sub">Five ways to see it</p>
          <Rings g={g} base={base} portal={portal} own={ownLibrary} />
          <Link className="pill gold block" href={`${base}/garden`} data-testid="see-sown">See what you&apos;ve sown</Link>
        </section>
        ) : null}
        {due && featureOn(portal, 'compass') ? (
          <section className="card" data-testid="recalibrate-card" style={{ marginBottom: 16 }}>
            <h2 style={{ marginTop: 0 }}>A fresh look, when you have a moment</h2>
            <p>Five short questions, in different words, and one line about life just now.</p>
            <Link className="pill ink" href={`${base}/recalibrate`} data-testid="recalibrate-open">Take a few moments</Link>
          </section>
        ) : null}
        {tonight && featureOn(portal, 'planner') ? (
          <section className="card home-plan" data-testid="home-plan">
            <p className="eyebrow">Your plan</p>
            <h2 data-testid="home-plan-line">{tonight.label}</h2>
            <p>{tonight.title}</p>
            <Link className="pill gold" href={tonight.href} data-testid="plan-continue">Continue</Link>
          </section>
        ) : null}
        <p className="eyebrow">This week</p>
        <WeekStrip days={week.days} today={week.today} scheduledKeys={week.scheduledKeys} href={`${base}/week`} emptyHref={`${base}/week`} />
        <p className="eyebrow">Continue</p>
        <div data-testid="continue">
          {carryOn.map((row) => (
            <Link key={row.id} className="continue-row" href={row.href} data-testid="continue-row" style={tint ? artStyle(coverColor(Number(row.href.match(/\/course\/(\d+)/)?.[1] || 0), row.id)) : undefined}>
              <span className={`thumb${tint || row.thumb ? '' : ' is-fallback'}`} style={tint ? { backgroundImage: `url(${coverPath('film', row.id)})` } : row.thumb ? { backgroundImage: `url(${row.thumb})` } : undefined}>
                {!tint && !row.thumb && modernHome ? <FilmFallback place={row.place} title={row.title} /> : null}
              </span>
              <span className="t">
                <b>{row.title}</b>
                <span className="sr-only">. </span>
                {tint ? <small className="cover-line">{coverLine(row.title)}</small> : null}
                <small>{row.sub}</small>
                {modernHome ? <span className="progress-ring" style={{ ['--progress' as string]: `${row.percent}%` }} aria-hidden="true"><span>{row.percent}%</span></span> : null}
              </span>
            </Link>
          ))}
          {fallback.map((course) => {
            const own = sortParts(fallbackLessons.filter((lesson) => ref(lesson.course) === course.id && learnerLessonVisible(asLessonVisibility(lesson))), () => 0)
            const watched = own.filter((lesson) => done.has(lesson.id)).length
            const poster = shownPoster(course.poster) || shownPoster(own.map((lesson) => filmPoster(lesson)).find(Boolean) || null)
            const first = own[0]
            const meta = modernHome
              ? `${course.sheetTitle ? `${course.sheetTitle} · ` : ''}${watched} of ${course.parts} film${course.parts === 1 ? '' : 's'}`
              : [course.speaker, plural(course.parts, 'part')].filter(Boolean).join(' · ')
            return (
              <Link key={course.id} className="continue-row" href={`${base}/course/${course.id}`} data-testid="continue-row" style={tint ? artStyle(coverColor(course.id)) : undefined}>
                <span className={`thumb${tint || poster ? '' : ' is-fallback'}`} style={tint ? { backgroundImage: `url(${coverPath('course', course.id)})` } : poster ? { backgroundImage: `url(${poster})` } : undefined}>
                  {!tint && !poster && modernHome && first ? <FilmFallback place={1} title={str(first.title)} /> : null}
                </span>
                <span className="t"><b>{tidyTalkTitle(course.title)}</b><span className="sr-only">. </span><small>{meta}</small><DoorChips doors={course.doors} max={1} /></span>
              </Link>
            )
          })}
          {!carryOn.length && !fallback.length ? <p className="muted">{modernHome ? 'Start a course from Courses and it will wait for you here.' : 'Start a course from Lanes and it will wait for you here.'}</p> : null}
        </div>
        {featureOn(portal, 'missions') ? await activeMissionCard(payload, portal.id, base, appNameOf(portal)) : null}
        <InstallCard strip appName={appNameOf(portal)} />
        {featureOn(portal, 'gather') ? <HomeGather cards={gatherings} base={base} masjid={portalName(portal)} /> : null}
        <p className="eyebrow">Today&apos;s clips <span className="muted" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600 }} data-testid="day-number">· Day {dayNumber(user)} with us</span></p>
        {!clips.length && nextFilms.length ? (
          <div data-testid="feed-films">
            {nextFilms.map((film) => (
              <Link key={film.href} className="continue-row" href={film.href} data-testid="feed-film" style={tint ? artStyle(coverColor(Number(film.href.match(/\/course\/(\d+)/)?.[1] || 0), Number(film.href.match(/part=(\d+)/)?.[1] || 0))) : undefined}>
                <span className={`thumb${tint || film.poster ? '' : ' is-fallback'}`} style={tint ? { backgroundImage: `url(${coverPath('film', Number(film.href.match(/part=(\d+)/)?.[1] || 0))})` } : film.poster ? { backgroundImage: `url(${film.poster})` } : undefined}>
                  {!tint && !film.poster && modernHome ? <FilmFallback place={film.place} title={film.title} /> : null}
                </span>
                <span className="t"><b>{film.place}. {film.title}</b><small>{film.course}</small>{modernHome ? <FilmChips seconds={film.seconds} done={film.done} /> : null}</span>
              </Link>
            ))}
          </div>
        ) : null}
        {clips.length ? (
        <Link className="feed-door" href={`${base}/feed`} data-testid="open-feed">
          <span className="strip">
            {clips.map((clip) => {
              const poster = shownPoster(clip.poster) || shownPoster(clip.portrait)
              // Slide backdrops are full-bleed files. A 64px tile must not download them.
              const thumb = poster && !poster.includes('/slides/') ? poster : null
              return <span key={clip.id} className="mini" style={thumb ? { backgroundImage: `url(${thumb})` } : undefined} />
            })}
          </span>
          <span className="go"><PlayIcon size={22} /> Watch today&apos;s clips</span>
        </Link>
        ) : null}
      </div>
      <LearnerTabBar base={base} active="home" portal={portal} unread={unread} />
    </AppFrame>
  )
}

const START = ['orange', 'gold', 'teal']

function snippet(text: string, max: number) {
  const polished = learnerWords(text)
  if (polished.length <= max) return polished
  const cut = polished.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, '')}…`
}

export async function LanesScreen({ payload, user, portal, base, query }: Ctx) {
  const [{ opening }, courses, unread, completions, sessions] = await Promise.all([
    learnerClips(payload, portal, user),
    courseCards(payload, user, portal.id),
    unreadCount(payload, user),
    rows(payload, 'completions', { user: { equals: user.id } }, { limit: 200 }),
    rows(payload, 'watch-sessions', { user: { equals: user.id } }, { limit: 400 }),
  ])
  const modernLanes = shellOf(portal) === 'modern'
  const ownLibrary = await portalOwnsLibrary(payload, portal.id)
  const lanes = ownLibrary ? [] : lanesWithClips(opening.route, opening.clips, opening.laneTitles)
  const nextFilms = lanes.length ? [] : await nextCourseFilms(payload, user, base, 4, portal.id)
  const today = dayNumber(user)
  return (
    <AppFrame testId="lanes" brand={learnerBrand(portal)}>
      <div className="app-scroll">
        <div className="app-head lanes-head">
          <div>
            <h1>Lanes</h1>
            <p className="page-sub" data-testid="lanes-sub">Paths to walk, one theme at a time.</p>
          </div>
          <span className="muted" style={{ fontSize: 13, fontWeight: 600 }} data-testid="day-number">Day {today} with us</span>
        </div>
        <Flash error={query.error} notice={query.notice} />
        {featureOn(portal, 'gather') ? <Link className="pill outline" href={`${base}/gather`} data-testid="open-gather" style={{ marginBottom: 14 }}>Gather</Link> : null}
        {lanes.map((lane) => {
          const first = lane.clips[0]
          const count = lane.clips.length
          const poster = shownPoster(first?.poster) || shownPoster(first?.portrait)
          const progress = getLaneProgress(lane.key, lane.clips.map((clip) => ({
            cutId: clip.cutId,
            lessonId: clip.lessonId,
            start: Number(clip.hors?.start || 0),
            end: Number(clip.hors?.end || 0),
            durationSeconds: Number(clip.talkSeconds || clip.durationSeconds || 0),
          })), watchFor(completions, sessions, lane.clips))
          const who = laneCardSpeaker(lane.clips)
          const startHref = progress.playCutId ? lanePlayPath(base, lane.key, progress.playCutId) : ''
          return (
            <article
              key={lane.key}
              className="lane-card"
              data-testid="lane-card"
              data-lane={lane.key}
              data-first-cut={first?.cutId}
              style={poster ? { backgroundImage: `url(${poster})` } : undefined}
            >
              <div>
                <Link className="lane-card-open" href={lanePagePath(base, lane.key)} data-testid="lane-open">
                  <small>Lane</small>
                  <h3>{learnerWords(lane.title)}</h3>
                  {lane.tree ? <p className="lane-grows" data-testid="lane-grows">Grows your {lane.tree} tree</p> : null}
                  {lane.doorNames.length ? <p className="lane-doors" data-testid="lane-doors">{lane.doorNames.join(' · ')}</p> : null}
                  <p>{LANE_BLURBS[lane.key] || snippet(first?.hookTidy || first?.hook || first?.scenic?.hook || first?.land || first?.lessonTitle || first?.courseTitle || '', 64)}</p>
                  <p>{`${who}${who ? ' · ' : ''}${count} ${count === 1 ? 'clip' : 'clips'}`}</p>
                </Link>
                <LaneProgressSlot progress={progress} startHref={progress.started ? undefined : startHref || undefined} />
              </div>
            </article>
          )
        })}
        {!lanes.length ? (
          <div data-testid="lanes-empty">
            {nextFilms.length ? nextFilms.map((film) => (
              <Link key={film.href} className="continue-row" href={film.href} data-testid="lane-film">
                <span className={`thumb${film.poster ? '' : ' is-fallback'}`} style={film.poster ? { backgroundImage: `url(${film.poster})` } : undefined} />
                <span className="t"><b>{film.place}. {film.title}</b><small>{film.course}</small>{modernLanes ? <FilmChips seconds={film.seconds} done={film.done} /> : null}</span>
              </Link>
            )) : <p className="card"><span>No clips have been approved yet. The courses below are ready to watch.</span></p>}
          </div>
        ) : null}
        <p className="eyebrow">Your courses</p>
        {courses.map((course, index) => {
          const href = `${base}/course/${course.id}`
          return (
            <div key={course.id} className="course-row" data-testid="path-course" data-open={course.open ? 'yes' : 'no'}>
              <span className="thumb" style={shownPoster(course.poster) ? { backgroundImage: `url(${shownPoster(course.poster)})` } : undefined} />
              <span className="t">
                <b>{learnerWords(tidyTalkTitle(course.title))}</b>
                <small>
                  {course.recommended ? <span className="drip" data-testid="recommended">This week · </span> : null}
                  {course.open ? `${course.parts} ${modernLanes ? (course.parts === 1 ? 'film' : 'films') : (course.parts === 1 ? 'part' : 'parts')} · ${course.speaker}` : <span className="drip" data-testid="opens-on">Opens on day {course.opensOnDay}</span>}
                </small>
                <DoorChips doors={course.doors} />
              </span>
              {course.open ? (
                <Link className={`start ${START[index % START.length]}`} href={`${href}?from=lanes`} data-testid="lesson-link">Start</Link>
              ) : (
                <Link className="start soft" href={href} data-testid="peek">Preview</Link>
              )}
            </div>
          )
        })}
        {!courses.length ? <p className="muted" data-testid="no-courses">Your access code does not include any courses yet. Ask your teacher.</p> : null}
        <p className="muted" style={{ fontSize: 13, marginTop: 14 }} data-testid="visible-courses">
          {courses.length} course{courses.length === 1 ? '' : 's'} in your library. Courses already in your clips are open; others open one a day, and you can always peek ahead.
        </p>
      </div>
      <LearnerTabBar base={base} active="lanes" portal={portal} unread={unread} />
    </AppFrame>
  )
}
