import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { Payload } from 'payload'
import { AppFrame, Flash } from '@/components/app/shell'
import { LearnerTabBar } from '@/components/app/learner-bar'
import { FilmFallback } from '@/components/app/film-fallback'
import { PlayIcon } from '@/components/icons'
import { learnerBrand } from '@/lib/learner-brand'
import { shellOf } from '@/lib/portal-look'
import { isSequencePortal, librarySections, sectionAnchor } from '@/lib/sequence'
import { sortParts } from '@/lib/part-order'
import { asLessonVisibility, learnerLessonVisible } from '@/lib/publish-state'
import { filmPoster, shownPoster } from '@/server/learner'
import { appleLookOnServer, artStyle, swatchMap } from '@/server/swatch'
import { visibleCourseIds } from '@/server/context'
import type { SessionUser } from '@/server/context'
import { type Ctx, clock, ref, rows, str } from '../common'

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
  posterUrl?: string | null
}

export type NextFilm = {
  href: string
  title: string
  course: string
  place: number
  poster: string | null
  seconds: number
  done: boolean
}

export function FilmChips({ seconds, done, coming }: { seconds: number; done?: boolean; coming?: boolean }) {
  return (
    <span className="film-meta">
      <span className="duration-chip">{seconds > 0 ? clock(seconds) : 'Length not known yet'}</span>
      {done ? <span className="done-check" data-testid="film-done">Done</span> : null}
      {coming ? <span className="duration-chip">Coming soon</span> : null}
    </span>
  )
}

function percent(done: number, total: number) {
  if (!total) return 0
  return Math.round((done / total) * 100)
}

function ringStyle(value: number): CSSProperties {
  return { ['--progress' as string]: `${value}%` }
}

export async function nextCourseFilms(payload: Payload, user: SessionUser, base: string, limit = 8, portalId?: number | null): Promise<NextFilm[]> {
  const courseIds = await visibleCourseIds(payload, user, portalId)
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
        poster: shownPoster(filmPoster(lesson)),
        seconds: Number(lesson.durationSeconds || 0),
        done: done.has(lesson.id),
      })
    }
  }
  return out
}

function Tick({ on }: { on: boolean }) {
  return <i className={on ? 'on' : ''} data-done={on ? 'yes' : 'no'} />
}

function Thumb({ src, eager, place, title }: { src: string | null; eager?: boolean; place?: number; title?: string }) {
  if (!src) {
    return (
      <span className="thumb is-fallback" data-testid="film-thumb">
        {place && title ? <FilmFallback place={place} title={title} /> : null}
      </span>
    )
  }
  return (
    <span className="thumb" data-testid="film-thumb">
      <img src={src} alt="" decoding="async" loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'low'} />
    </span>
  )
}

export async function CourseHomeScreen({ payload, user, portal, base, query }: Ctx) {
  const courseIds = await visibleCourseIds(payload, user, portal.id)
  const [courses, lessonRows, unitRows] = await Promise.all([
    courseIds.length ? rows(payload, 'courses', { id: { in: courseIds } }, { limit: isSequencePortal(portal) ? 80 : 40 }) : Promise.resolve([]),
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
    const poster = shownPoster(own.map((lesson) => filmPoster(lesson)).find(Boolean) || null)
    const nextPoster = next ? shownPoster(filmPoster(next)) : null
    return { course, own, finished, next, nextAt: next ? Math.max(0, nextAt) : 0, poster, nextPoster }
  }).filter((card) => card.own.length)
  const carry = cards.find((card) => card.finished < card.own.length) || cards[0]
  const modern = shellOf(portal) === 'modern'
  const sequence = isSequencePortal(portal)
  const carryPct = carry ? percent(carry.finished, carry.own.length) : 0
  const tint = await appleLookOnServer()
  const colors = tint ? await swatchMap(cards.flatMap((card) => [card.poster, card.nextPoster])) : new Map<string, string>()
  const sections = librarySections(cards.map((card) => ({
    ...card,
    title: str(card.course.title),
    sheetTitle: str(card.course.sheetTitle),
    sheetOrder: Number(card.course.sheetOrder || 0),
  })))
  return (
    <AppFrame testId="garden" brand={learnerBrand(portal)}>
      <div className="app-scroll" data-testid="course-home">
        <Flash error={query.error} notice={query.notice} />
        <div className="app-head"><h1>Courses</h1></div>
        {modern ? (
          <a className="list-link" href={`${base}/workbook`} data-testid="open-workbook">
            <span className="grow">Workbook<small>The first ten films</small></span>
            <span aria-hidden>›</span>
          </a>
        ) : null}
        {carry?.next ? (
          <article className="carry-on" data-testid="carry-on" style={artStyle(colors.get((modern ? (carry.nextPoster || carry.poster) : carry.poster) || ''))} data-art={colors.size ? '1' : undefined}>
            <Thumb src={modern ? (carry.nextPoster || carry.poster) : carry.poster} eager place={modern ? carry.nextAt + 1 : undefined} title={modern ? str(carry.next.title) : undefined} />
            {modern ? (
              <div className="carry-copy">
                <p className="eyebrow">Carry on</p>
                <h2>{carry.nextAt + 1}. {str(carry.next.title)}</h2>
                <p className="muted">{str(carry.course.title)} · {carry.finished} of {carry.own.length} films</p>
                <span className="progress-ring" style={ringStyle(carryPct)} aria-hidden="true"><span>{carryPct}%</span></span>
              </div>
            ) : (
              <>
                <p className="eyebrow">Carry on</p>
                <h2>{carry.nextAt + 1}. {str(carry.next.title)}</h2>
                <p className="muted">{str(carry.course.title)} · {carry.finished} of {carry.own.length} films</p>
              </>
            )}
            <div className="bar" data-testid="carry-bar"><i style={{ width: `${carryPct}%` }} /></div>
            <Link className="pill gold block play-btn" href={`${base}/course/${carry.course.id}?part=${carry.next.id}`} data-testid="carry-continue">
              {modern ? <><PlayIcon size={22} /> Play</> : 'Continue'}
            </Link>
          </article>
        ) : <p className="card">Films will show here once a course is added.</p>}
        {sequence ? sections.map((section) => (
          <section className="library-section" key={section.title} data-testid="library-collection" style={artStyle(colors.get(section.cards.find((card) => card.poster)?.poster || ''))} data-art={colors.size ? '1' : undefined}>
            <h2>{section.title}</h2>
            <div className="course-cards">
              {section.cards.map((card, index) => {
                const groups: { title: string; count: number }[] = []
                for (const lesson of card.own) {
                  const title = unitTitle.get(ref(lesson.unit) || 0) || 'Films'
                  const last = groups[groups.length - 1]
                  if (!last || last.title !== title) groups.push({ title, count: 0 })
                  groups[groups.length - 1].count += 1
                }
                const pct = percent(card.finished, card.own.length)
                const length = card.own.reduce((sum, lesson) => sum + Number(lesson.durationSeconds || 0), 0)
                return (
                  <Link key={card.course.id} className="course-card" href={`${base}/course/${card.course.id}`} data-testid="course-card" style={artStyle(colors.get(card.poster || ''))} data-art={colors.get(card.poster || '') ? '1' : undefined}>
                    <Thumb src={card.poster} eager={index < 2} place={card.next ? card.nextAt + 1 : undefined} title={card.next ? str(card.next.title) : undefined} />
                    <span className="t">
                      <b>{str(card.course.title)}</b>
                      <small>{card.own.length} film{card.own.length === 1 ? '' : 's'}{length ? ` · ${clock(length)}` : ''} · {pct}%</small>
                      <span className="bar"><i style={{ width: `${pct}%` }} /></span>
                      <span className="progress-ring" style={ringStyle(pct)} aria-hidden="true"><span>{pct}%</span></span>
                      {groups.length > 1 ? <small className="muted">{groups.map((group) => group.title).join(' · ')}</small> : null}
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        )) : (
          <div className="course-cards">
            {cards.map((card, index) => {
              const groups: { title: string; count: number }[] = []
              for (const lesson of card.own) {
                const title = unitTitle.get(ref(lesson.unit) || 0) || 'Films'
                const last = groups[groups.length - 1]
                if (!last || last.title !== title) groups.push({ title, count: 0 })
                groups[groups.length - 1].count += 1
              }
              const pct = percent(card.finished, card.own.length)
              return (
                <div key={card.course.id}>
                  <Link className="course-card" href={`${base}/course/${card.course.id}`} data-testid="course-card">
                    <Thumb src={card.poster} eager={index < 2} place={modern && card.next ? card.nextAt + 1 : undefined} title={modern && card.next ? str(card.next.title) : undefined} />
                    <span className="t">
                      <b>{str(card.course.title)}</b>
                      <small>{card.own.length} film{card.own.length === 1 ? '' : 's'}</small>
                      <span className="bar"><i style={{ width: `${pct}%` }} /></span>
                      {modern ? (
                        <span className="progress-ring" style={ringStyle(pct)} aria-hidden="true"><span>{pct}%</span></span>
                      ) : (
                        <span className="ticks" data-testid="course-ticks">
                          {card.own.slice(0, 24).map((lesson) => <Tick key={lesson.id} on={done.has(lesson.id)} />)}
                        </span>
                      )}
                      {groups.length > 1 ? <small className="muted">{groups.map((group) => group.title).join(' · ')}</small> : null}
                    </span>
                  </Link>
                  {modern && groups.length ? (
                    <div data-testid="course-sections">
                      {groups.map((group) => (
                        <Link className="garden-area" href={`${base}/course/${card.course.id}#${sectionAnchor(group.title)}`} data-testid="garden-area" key={group.title}>
                          <strong>{group.title}</strong>
                          <small>{group.count} films</small>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
      <LearnerTabBar base={base} active="garden" portal={portal} />
    </AppFrame>
  )
}
