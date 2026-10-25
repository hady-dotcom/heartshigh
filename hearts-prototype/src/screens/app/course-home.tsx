import Link from 'next/link'
import type { Payload } from 'payload'
import { AppFrame, Flash } from '@/components/app/shell'
import { LearnerTabBar } from '@/components/app/learner-bar'
import { learnerBrand } from '@/lib/learner-brand'
import { sortParts } from '@/lib/part-order'
import { asLessonVisibility, learnerLessonVisible } from '@/lib/publish-state'
import { posterFor, shownPoster } from '@/server/learner'
import { visibleCourseIds } from '@/server/context'
import type { SessionUser } from '@/server/context'
import { type Ctx, ref, rows, str } from '../common'

type FilmRow = {
  id: number
  title?: string | null
  course?: unknown
  unit?: unknown
  order?: number | null
  youtubeId?: string | null
  vimeoId?: string | null
  videoProvider?: string | null
  durationSeconds?: number | null
}

export type NextFilm = {
  href: string
  title: string
  course: string
  place: number
  poster: string | null
}

export async function nextCourseFilms(payload: Payload, user: SessionUser, base: string, limit = 8): Promise<NextFilm[]> {
  const courseIds = await visibleCourseIds(payload, user)
  if (!courseIds.length) return []
  const [courses, lessonRows] = await Promise.all([
    rows(payload, 'courses', { id: { in: courseIds } }, { limit: 40 }),
    rows(payload, 'lessons', { course: { in: courseIds } }, { sort: 'order', limit: 400 }),
  ])
  const visible = (lessonRows as FilmRow[]).filter((lesson) => learnerLessonVisible(asLessonVisibility(lesson)))
  const ids = visible.map((lesson) => lesson.id)
  const doneRows = ids.length
    ? await rows(payload, 'completions', { and: [{ user: { equals: user.id } }, { lesson: { in: ids } }] }, { limit: 400 })
    : []
  const done = new Set(doneRows.filter((row) => Number(row.percent ?? 100) >= 90).map((row) => ref(row.lesson)))
  const out: NextFilm[] = []
  for (const course of courses) {
    const own = sortParts(visible.filter((lesson) => ref(lesson.course) === course.id), () => 0)
    const start = own.findIndex((lesson) => !done.has(lesson.id))
    const from = start >= 0 ? start : 0
    for (let index = from; index < own.length && out.length < limit; index += 1) {
      const lesson = own[index]
      out.push({
        href: `${base}/course/${course.id}?part=${lesson.id}`,
        title: str(lesson.title),
        course: str(course.title),
        place: index + 1,
        poster: shownPoster(posterFor(str(lesson.youtubeId) || null)),
      })
    }
  }
  return out
}

function Tick({ on }: { on: boolean }) {
  return <i className={on ? 'on' : ''} data-done={on ? 'yes' : 'no'} />
}

function Thumb({ src, eager }: { src: string | null; eager?: boolean }) {
  if (!src) return <span className="thumb" />
  return (
    <span className="thumb">
      <img src={src} alt="" decoding="async" loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'low'} />
    </span>
  )
}

export async function CourseHomeScreen({ payload, user, portal, base, query }: Ctx) {
  const courseIds = await visibleCourseIds(payload, user)
  const [courses, lessonRows, unitRows] = await Promise.all([
    courseIds.length ? rows(payload, 'courses', { id: { in: courseIds } }, { limit: 40 }) : Promise.resolve([]),
    courseIds.length ? rows(payload, 'lessons', { course: { in: courseIds } }, { sort: 'order', limit: 500 }) : Promise.resolve([]),
    courseIds.length ? rows(payload, 'units', { course: { in: courseIds } }, { sort: 'order', limit: 80 }) : Promise.resolve([]),
  ])
  const visible = (lessonRows as FilmRow[]).filter((lesson) => learnerLessonVisible(asLessonVisibility(lesson)))
  const ids = visible.map((lesson) => lesson.id)
  const doneRows = ids.length
    ? await rows(payload, 'completions', { and: [{ user: { equals: user.id } }, { lesson: { in: ids } }] }, { limit: 500 })
    : []
  const done = new Set(doneRows.filter((row) => Number(row.percent ?? 100) >= 90).map((row) => ref(row.lesson)))
  const unitTitle = new Map(unitRows.map((unit) => [unit.id, str(unit.title)]))
  const cards = courses.map((course) => {
    const own = sortParts(visible.filter((lesson) => ref(lesson.course) === course.id), () => 0)
    const finished = own.filter((lesson) => done.has(lesson.id)).length
    const nextAt = own.findIndex((lesson) => !done.has(lesson.id))
    const next = own[nextAt] || own[0]
    const poster = shownPoster(posterFor(str(own.find((lesson) => lesson.youtubeId)?.youtubeId) || null))
    return { course, own, finished, next, nextAt: next ? Math.max(0, nextAt) : 0, poster }
  }).filter((card) => card.own.length)
  const carry = cards.find((card) => card.finished < card.own.length) || cards[0]
  return (
    <AppFrame testId="garden" brand={learnerBrand(portal)}>
      <div className="app-scroll" data-testid="course-home">
        <Flash error={query.error} notice={query.notice} />
        <div className="app-head"><h1>Courses</h1></div>
        {carry?.next ? (
          <article className="carry-on" data-testid="carry-on">
            <Thumb src={carry.poster} eager />
            <p className="eyebrow">Carry on</p>
            <h2>{carry.nextAt + 1}. {str(carry.next.title)}</h2>
            <p className="muted">{str(carry.course.title)} · {carry.finished} of {carry.own.length} films</p>
            <div className="bar" data-testid="carry-bar"><i style={{ width: `${carry.own.length ? (carry.finished / carry.own.length) * 100 : 0}%` }} /></div>
            <Link className="pill gold block" href={`${base}/course/${carry.course.id}?part=${carry.next.id}`} data-testid="carry-continue">Continue</Link>
          </article>
        ) : <p className="card">Films will show here once a course is added.</p>}
        <div className="course-cards">
          {cards.map((card, index) => {
            const groups: { title: string; count: number }[] = []
            for (const lesson of card.own) {
              const title = unitTitle.get(ref(lesson.unit) || 0) || 'Films'
              const last = groups[groups.length - 1]
              if (!last || last.title !== title) groups.push({ title, count: 0 })
              groups[groups.length - 1].count += 1
            }
            return (
              <Link key={card.course.id} className="course-card" href={`${base}/course/${card.course.id}`} data-testid="course-card">
                <Thumb src={card.poster} eager={index < 2} />
                <span className="t">
                  <b>{str(card.course.title)}</b>
                  <small>{card.own.length} film{card.own.length === 1 ? '' : 's'}</small>
                  <span className="bar"><i style={{ width: `${card.own.length ? (card.finished / card.own.length) * 100 : 0}%` }} /></span>
                  <span className="ticks" data-testid="course-ticks">
                    {card.own.slice(0, 24).map((lesson) => <Tick key={lesson.id} on={done.has(lesson.id)} />)}
                  </span>
                  {groups.length > 1 ? <small className="muted">{groups.map((group) => group.title).join(' · ')}</small> : null}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
      <LearnerTabBar base={base} active="garden" portal={portal} />
    </AppFrame>
  )
}
