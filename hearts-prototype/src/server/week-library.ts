import type { Payload } from 'payload'
import { asLessonVisibility, learnerLessonVisible } from '@/lib/publish-state'
import { sortParts, type PartLesson } from '@/lib/part-order'
import { librarySections } from '@/lib/sequence'
import type { WeekCourse, WeekSection } from '@/lib/week-library'
import { filmPoster, shownPoster } from '@/server/learner'
import { guestLibrary } from '@/server/guest-films'
import { visibleCourseIds, type PortalDoc, type SessionUser } from '@/server/context'
import { clock, ref, rows, str } from '@/screens/common'

function sectionsOf(courses: WeekCourse[]): WeekSection[] {
  return librarySections(courses).map((section) => ({ title: section.title, courses: section.cards }))
}

function lengthLabel(seconds: number) {
  return seconds > 0 ? ` · ${clock(seconds)}` : ''
}

/** Portal courses for a signed-out parent. Progress stays on the phone. */
export async function guestWeekSections(payload: Payload, portalId: number, base: string): Promise<WeekSection[]> {
  const library = await guestLibrary(payload, portalId, base)
  const courses: WeekCourse[] = library.courses.map((card) => {
    const films = (library.lists.get(card.id) || []).map((film) => ({
      id: film.lessonId,
      title: film.title,
      place: film.place,
      href: film.href,
      done: false,
    }))
    const first = films[0]
    return {
      id: card.id,
      title: card.title,
      sheetTitle: card.sheetTitle,
      sheetOrder: card.sheetOrder,
      count: films.length,
      lengthLabel: lengthLabel(card.seconds),
      href: card.listHref,
      poster: card.poster,
      filmTitle: first?.title || card.filmTitle,
      place: first?.place || card.place,
      films,
      finished: 0,
    }
  }).filter((course) => course.films.length)
  return sectionsOf(courses)
}

/** The same cards for a signed-in parent, with films already watched filled in. */
export async function learnerWeekSections(payload: Payload, user: SessionUser, portal: PortalDoc, base: string): Promise<WeekSection[]> {
  const courseIds = await visibleCourseIds(payload, user, portal.id)
  if (!courseIds.length) return []
  const [courseRows, lessonRows] = await Promise.all([
    rows(payload, 'courses', { id: { in: courseIds } }, { limit: 80 }),
    rows(payload, 'lessons', { course: { in: courseIds } }, { sort: 'order', limit: 800 }),
  ])
  const visible = lessonRows.filter((lesson) => learnerLessonVisible(asLessonVisibility(lesson)))
  const byId = new Map(visible.map((lesson) => [lesson.id, lesson]))
  const ids = visible.map((lesson) => lesson.id)
  const doneRows = ids.length
    ? await rows(payload, 'completions', { and: [{ user: { equals: user.id } }, { lesson: { in: ids } }] }, { limit: 800 })
    : []
  const done = new Set(doneRows.filter((row) => Number(row.percent ?? 100) >= 90).map((row) => ref(row.lesson)))
  const courses: WeekCourse[] = courseRows.map((course) => {
    const own = sortParts(visible.filter((lesson) => ref(lesson.course) === course.id) as PartLesson[])
    const films = own.map((lesson, index) => ({
      id: lesson.id,
      title: str(lesson.title) || 'Film',
      place: index + 1,
      href: `${base}/course/${course.id}?part=${lesson.id}`,
      done: done.has(lesson.id),
    }))
    const finished = films.filter((film) => film.done).length
    const next = films.find((film) => !film.done) || films[0]
    const seconds = own.reduce((sum, lesson) => sum + Number(byId.get(lesson.id)?.durationSeconds || 0), 0)
    const poster = shownPoster(own.map((lesson) => filmPoster(byId.get(lesson.id))).find(Boolean) || null)
    return {
      id: course.id,
      title: str(course.title) || 'Course',
      sheetTitle: str(course.sheetTitle),
      sheetOrder: Number(course.sheetOrder || 0),
      count: films.length,
      lengthLabel: lengthLabel(seconds),
      href: `${base}/course/${course.id}`,
      poster,
      filmTitle: next?.title || 'Film',
      place: next?.place || 1,
      films,
      finished,
    }
  }).filter((course) => course.films.length)
  return sectionsOf(courses)
}
