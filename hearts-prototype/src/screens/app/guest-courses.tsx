import Link from 'next/link'
import { headers } from 'next/headers'
import type { Payload } from 'payload'
import { AppFrame } from '@/components/app/shell'
import { FilmFallback } from '@/components/app/film-fallback'
import { LearnerTabBar } from '@/components/app/learner-bar'
import { CoursePlayer, type PointView } from '@/components/app/course-player'
import { learnerBrand } from '@/lib/learner-brand'
import { shownCalloutSecond } from '@/lib/portal-look'
import { filmCanPlay } from '@/lib/film-availability'
import { shownQuestionPrompt } from '@/lib/question-prompt'
import { kineticMomentsOn, librarySections, sectionAnchor, sectionGroups, sequenceProgress, SEQUENCE_COPY } from '@/lib/sequence'
import { sortParts } from '@/lib/part-order'
import { learnerLessonVisible } from '@/lib/publish-state'
import type { PortalDoc } from '@/server/context'
import { filmPoster, shownPoster } from '@/server/learner'
import { GuestCourseResume, GuestDone, GuestMeBody, GuestWeekBody } from '@/components/app/guest-places'
import { shareOrigin } from '@/lib/site-origin'
import { guestLibrary } from '@/server/guest-films'
import { FilmChips } from './course-home'
import { kineticClipFor } from '@/server/sequence-desk'
import { loadFilmSwarm } from '@/server/parent-swarm'
import { clock, ref, rows, str, type Row } from '../common'

/** Courses for a signed-out visitor. No account, and no dark empty feed. */
export async function GuestCoursesScreen({ payload, portal, base }: { payload: Payload; portal: PortalDoc; base: string }) {
  const library = await guestLibrary(payload, portal.id, base)
  return (
    <AppFrame testId="garden" brand={learnerBrand(portal)}>
      <div className="app-scroll" data-testid="course-home">
        <div className="app-head"><h1>Courses</h1></div>
        <a className="list-link" href={`${base}/workbook`} data-testid="open-workbook">
          <span className="grow">Workbook<small>The first ten films</small></span>
          <span aria-hidden>›</span>
        </a>
        {library.courses.length ? librarySections(library.courses).map((section) => (
          <section className="library-section" key={section.title} data-testid="library-collection">
            <h2>{section.title}</h2>
            <div className="course-cards">
              {section.cards.map((course) => (
                <a key={course.id} className="course-card" href={course.listHref} data-testid="course-card">
                  {course.poster ? <span className="thumb"><img src={course.poster} alt="" /></span> : (
                    <span className="thumb is-fallback" data-testid="film-thumb"><FilmFallback place={course.place} title={course.filmTitle} /></span>
                  )}
                  <span className="t">
                    <b>{course.title}</b>
                    <small>{course.count} film{course.count === 1 ? '' : 's'}{course.seconds ? ` · ${clock(course.seconds)}` : ''}</small>
                  </span>
                </a>
              ))}
            </div>
          </section>
        )) : <p className="card">Films will show here once a course is added.</p>}
      </div>
      <LearnerTabBar base={base} active="garden" portal={portal} />
    </AppFrame>
  )
}

async function courseFilms(payload: Payload, portalId: number, courseId: number) {
  const course = (await rows(payload, 'courses', { and: [{ id: { equals: courseId } }, { portal: { equals: portalId } }] }, { limit: 1 }))[0]
  if (!course || course.hidden === true) return null
  const [lessonRows, unitRows] = await Promise.all([
    rows(payload, 'lessons', { course: { equals: courseId } }, { sort: 'order', limit: 500 }),
    rows(payload, 'units', { course: { equals: courseId } }, { sort: 'order', limit: 80 }),
  ])
  const unitRank = new Map(unitRows.map((unit, index) => [unit.id, index]))
  const lessons = sortParts(lessonRows, (row) => unitRank.get(ref(row.unit) || 0) ?? 99).filter((row) => learnerLessonVisible({
    publishState: str(row.publishState),
    transcriptNote: str(row.transcriptNote),
    tooShort: row.tooShort === true,
    binned: row.binned === true,
  }))
  if (!lessons.length) return null
  return { course, lessons, unitRows }
}

function playableLesson(lesson: Row) {
  return filmCanPlay({ vimeoId: str(lesson.vimeoId), youtubeId: str(lesson.youtubeId), videoProvider: str(lesson.videoProvider) })
}

function pointViews(points: Row[], lesson: Row): PointView[] {
  return points.filter((point) => ref(point.lesson) === lesson.id && str(point.family) !== 'workbook').map((point, index) => ({
    id: point.id,
    number: index + 1,
    second: shownCalloutSecond(Number(point.second || 0), Number(lesson.durationSeconds || 0), true),
    prompt: shownQuestionPrompt(str(point.prompt), { sheet: true, index }),
    kind: (['reflection', 'question', 'multiple_choice', 'task'].includes(str(point.kind)) ? point.kind : 'reflection') as PointView['kind'],
    options: Array.isArray(point.options) ? (point.options as unknown[]).map(String) : [],
    state: 'open' as const,
    unlocksAt: null,
    answered: false,
    timeLimitSec: Number(point.timeLimitSec || 0) || null,
  })).filter((view) => view.prompt)
}

/** The same course player a signed-in parent uses. Answers stay on this phone until an account sends them. */
export async function GuestCourseScreen({ payload, portal, base, courseId, part, at, clip }: { payload: Payload; portal: PortalDoc; base: string; courseId: number; part?: string; at?: string; clip?: string }) {
  const loaded = await courseFilms(payload, portal.id, courseId)
  if (!loaded) return null
  const { course, lessons, unitRows } = loaded
  const title = str(course.title) || 'Course'
  const groups = sectionGroups(lessons, (lesson) => str(unitRows.find((unit) => unit.id === ref(lesson.unit))?.title) || 'Films')
  if (!part) {
    const firstAt = lessons.findIndex((lesson) => playableLesson(lesson))
    const first = firstAt >= 0 ? lessons[firstAt] : null
    return (
      <AppFrame testId="course-overview" brand={learnerBrand(portal)}>
        <div className="app-scroll">
          <div className="app-head course-head">
            <a className="back" href={`${base}/courses`} data-testid="back">‹ Courses</a>
            <h1 data-testid="course-title">{title}</h1>
          </div>
          <div data-testid="play-next">
            <p className="eyebrow">Play next</p>
            <GuestCourseResume base={base} courseId={course.id} total={lessons.length} firstId={first?.id ?? null} firstPlace={first ? firstAt + 1 : 1} />
          </div>
          <p className="muted">Questions appear inside each film, once you open it. Answers stay on this phone.</p>
          <a className="list-link" href={`${base}/workbook`} data-testid="open-workbook">
            <span className="grow">Workbook<small>Your answer and a few from other parents</small></span>
            <span aria-hidden>›</span>
          </a>
          <div data-testid="sequence-list">
            {groups.map((group) => (
              <section className="sequence-module" id={sectionAnchor(group.title)} key={group.title} data-testid="sequence-module">
                <h2>{group.title}</h2>
                {group.rows.map(({ item: lesson, index }) => {
                  const playable = playableLesson(lesson)
                  const poster = shownPoster(filmPoster(lesson))
                  const href = `${base}/course/${course.id}?part=${lesson.id}`
                  return (
                    <Link key={lesson.id} className="buffet-row" href={playable ? href : href} data-testid="buffet-talk" data-coming={playable ? 'no' : 'yes'}>
                      <span className={`thumb${poster ? '' : ' is-fallback'}`} data-testid="talk-thumb">
                        {poster ? <img src={poster} alt="" /> : <FilmFallback place={index + 1} title={str(lesson.title)} />}
                      </span>
                      <span className="t">
                        <small>Film {index + 1}</small>
                        <b className="talk-name">{str(lesson.title)}</b>
                        <FilmChips seconds={Number(lesson.durationSeconds || 0)} coming={!playable} />
                        <GuestDone lessonId={lesson.id} />
                      </span>
                      ›
                    </Link>
                  )
                })}
              </section>
            ))}
          </div>
        </div>
        <LearnerTabBar base={base} active="garden" portal={portal} />
      </AppFrame>
    )
  }
  const partIndex = Math.max(0, lessons.findIndex((lesson) => String(lesson.id) === String(part)))
  const lesson = lessons[partIndex] || lessons[0]
  const points = await rows(payload, 'engagement-points', { lesson: { equals: lesson.id } }, { sort: 'second', limit: 40 })
  const nextAt = lessons.findIndex((row, index) => index > partIndex && playableLesson(row))
  const prevAt = (() => { for (let index = partIndex - 1; index >= 0; index -= 1) if (playableLesson(lessons[index])) return index; return -1 })()
  const nextLesson = nextAt >= 0 ? lessons[nextAt] : null
  const prevLesson = prevAt >= 0 ? lessons[prevAt] : null
  const here = `${base}/course/${course.id}?part=${lesson.id}`
  const coming = !playableLesson(lesson)
  const progress = sequenceProgress(0, lessons.length)
  const shareUrl = `${shareOrigin(await headers())}${here}`
  const kineticTier = kineticMomentsOn(portal) ? await kineticClipFor(payload, lesson.id) : null
  const filmPoints = pointViews(points, lesson)
  const swarm = await loadFilmSwarm(payload, portal.id, filmPoints.map((point) => point.id))
  return (
    <AppFrame testId="course" brand={learnerBrand(portal)}>
      <div className="app-scroll">
        <CoursePlayer
          guest
          films
          courseTitle={title}
          backHref={`${base}/course/${course.id}`}
          lessonId={lesson.id}
          partLabel={`${partIndex + 1}. ${str(lesson.title)}`}
          youtubeId={coming ? null : str(lesson.youtubeId) || null}
          film={coming ? null : str(lesson.vimeoId) ? { provider: 'vimeo', vimeoId: str(lesson.vimeoId), vimeoHash: str(lesson.vimeoHash) || null } : null}
          poster={shownPoster(filmPoster(lesson))}
          duration={Number(lesson.durationSeconds || 0)}
          startAt={Number(at) || 0}
          clipEnd={clip === '1' && kineticTier ? kineticTier.end : null}
          points={filmPoints}
          swarm={swarm}
          swarmOn
          shareChoice
          serverNow={new Date().toISOString()}
          next={here}
          upNext={nextLesson ? { href: `${base}/course/${course.id}?part=${nextLesson.id}`, label: `${nextAt + 1}. ${str(nextLesson.title)}`, minutes: Math.max(1, Math.round(Number(nextLesson.durationSeconds || 0) / 60)), last: false } : { href: `${base}/course/${course.id}`, label: SEQUENCE_COPY.back, minutes: 0, last: true }}
          courseHref={`${base}/course/${course.id}`}
          progressCard={{ eyebrow: progress.eyebrow, line: progress.line, backLabel: progress.back, backHref: `${base}/course/${course.id}` }}
          saveOnEnd
          videoComing={coming}
          shareUrl={shareUrl}
          guestMeta={{ courseId: course.id, place: partIndex + 1, filmTitle: str(lesson.title) || 'Film' }}
          garden={{
            done: 0,
            total: lessons.length,
            gardenHref: `${base}/courses`,
            nextPart: nextLesson ? { label: `Film ${nextAt + 1} · Next`, href: `${base}/course/${course.id}?part=${nextLesson.id}` } : null,
            prevPart: prevLesson ? { label: `Film ${prevAt + 1} · Previous`, href: `${base}/course/${course.id}?part=${prevLesson.id}` } : null,
            links: [{ label: 'Workbook', href: `${base}/workbook` }],
          }}
        />
        {kineticTier ? (
          <section className="card" data-testid="kinetic-clip" data-start={kineticTier.start} data-end={kineticTier.end}>
            <p><b>Kinetic text.</b> {kineticTier.quote}</p>
            <Link href={`${base}/course/${course.id}?part=${lesson.id}&t=${kineticTier.start}&clip=1`} data-testid="kinetic-play">{SEQUENCE_COPY.playClip}</Link>
          </section>
        ) : null}
        {filmPoints[0] ? <p data-testid="sequence-question"><b>{SEQUENCE_COPY.question}.</b> {filmPoints[0].prompt}</p> : null}
      </div>
      <LearnerTabBar base={base} active="home" portal={portal} />
    </AppFrame>
  )
}

export async function GuestWeekScreen({ portal, base }: { portal: PortalDoc; base: string }) {
  return (
    <AppFrame testId="plan" brand={learnerBrand(portal)}>
      <GuestWeekBody base={base} portal={portal.slug} />
      <LearnerTabBar base={base} active="week" portal={portal} />
    </AppFrame>
  )
}

export async function GuestMeScreen({ portal, base }: { portal: PortalDoc; base: string }) {
  return (
    <AppFrame testId="me" brand={learnerBrand(portal)}>
      <GuestMeBody base={base} portal={portal.slug} />
      <LearnerTabBar base={base} active="me" portal={portal} />
    </AppFrame>
  )
}
