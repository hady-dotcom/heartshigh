import type { Payload } from 'payload'
import type { GuestFilm } from '@/lib/guest-film'
import { filmCanPlay } from '@/lib/film-availability'
import { sortParts } from '@/lib/part-order'
import { asLessonVisibility, learnerLessonVisible } from '@/lib/publish-state'
import { rows, str, ref } from '@/screens/common'
import { filmPoster, shownPoster } from '@/server/learner'

const HEX = /^[0-9a-f]{6,20}$/i

type CourseRow = { id: number; title?: string | null; hidden?: boolean | null; visibility?: string | null }
type LessonRow = {
  id: number
  title?: string | null
  sourceTitle?: string | null
  course?: unknown
  order?: number | null
  youtubeId?: string | null
  vimeoId?: string | null
  vimeoHash?: string | null
  videoProvider?: string | null
  posterUrl?: string | null
}

export type GuestCourseCard = {
  id: number
  title: string
  count: number
  href: string
  poster: string | null
  place: number
  filmTitle: string
}

function guidingFirst(title: string) {
  return /guid|home learning/i.test(title) ? 0 : 1
}

function toFilm(course: CourseRow, lesson: LessonRow, place: number, base: string): GuestFilm {
  const hash = str(lesson.vimeoHash).trim()
  const youtubeId = str(lesson.youtubeId).trim()
  return {
    courseId: course.id,
    courseTitle: str(course.title),
    lessonId: lesson.id,
    title: str(lesson.title) || str(lesson.sourceTitle) || 'Film',
    place,
    poster: shownPoster(filmPoster(lesson)),
    vimeoId: str(lesson.vimeoId).trim(),
    vimeoHash: HEX.test(hash) ? hash : null,
    youtubeId: /^[\w-]{11}$/.test(youtubeId) ? youtubeId : null,
    href: `${base}/course/${course.id}?part=${lesson.id}`,
    coursesHref: `${base}/courses`,
  }
}

/** Local courses on this portal, in teaching order, with the first film that can play. */
export async function guestLibrary(payload: Payload, portalId: number, base: string) {
  const courses = (await rows(payload, 'courses', { portal: { equals: portalId } }, { limit: 40 }) as CourseRow[])
    .filter((course) => course.hidden !== true && str(course.visibility) !== 'draft')
    .sort((a, b) => guidingFirst(str(a.title)) - guidingFirst(str(b.title)) || a.id - b.id)
  const ids = courses.map((course) => course.id)
  if (!ids.length) return { first: null as GuestFilm | null, courses: [] as GuestCourseCard[], films: new Map<number, GuestFilm>() }
  const lessons = (await rows(payload, 'lessons', { course: { in: ids } }, { sort: 'order', limit: 500 })) as LessonRow[]
  const visible = lessons.filter((lesson) => learnerLessonVisible(asLessonVisibility(lesson)))
  const cards: GuestCourseCard[] = []
  const films = new Map<number, GuestFilm>()
  let first: GuestFilm | null = null
  for (const course of courses) {
    const own = sortParts(visible.filter((lesson) => ref(lesson.course) === course.id))
    const playable = own.map((lesson, index) => ({ lesson, place: index + 1 })).filter(({ lesson }) => filmCanPlay(lesson))
    if (!playable.length) continue
    const vimeo = playable.find(({ lesson }) => str(lesson.vimeoId).trim())
    const start = vimeo || playable.find(({ lesson }) => str(lesson.youtubeId).trim()) || playable[0]
    const film = toFilm(course, start.lesson, start.place, base)
    films.set(course.id, film)
    if (!first && film.vimeoId) first = film
    const poster = shownPoster(own.map((lesson) => filmPoster(lesson)).find(Boolean) || null)
    cards.push({
      id: course.id,
      title: str(course.title) || 'Course',
      count: own.length,
      href: film.href,
      poster,
      place: start.place,
      filmTitle: film.title,
    })
  }
  if (!first) first = films.values().next().value || null
  return { first, courses: cards, films }
}

export async function firstGuestFilm(payload: Payload, portalId: number, base: string) {
  return (await guestLibrary(payload, portalId, base)).first
}

export async function guestCourseFilm(payload: Payload, portalId: number, base: string, courseId: number, partId?: number) {
  const library = await guestLibrary(payload, portalId, base)
  const card = library.courses.find((course) => course.id === courseId)
  const film = library.films.get(courseId)
  if (!card || !film) return null
  if (!partId || partId === film.lessonId) return { card, film }
  const lessons = (await rows(payload, 'lessons', { and: [{ id: { equals: partId } }, { course: { equals: courseId } }] }, { limit: 1 })) as LessonRow[]
  const lesson = lessons[0]
  if (!lesson || !learnerLessonVisible(asLessonVisibility(lesson)) || !filmCanPlay(lesson)) return { card, film }
  const own = sortParts((await rows(payload, 'lessons', { course: { equals: courseId } }, { sort: 'order', limit: 500 }) as LessonRow[]).filter((row) => learnerLessonVisible(asLessonVisibility(row))))
  const place = Math.max(1, own.findIndex((row) => row.id === lesson.id) + 1)
  return { card, film: toFilm({ id: courseId, title: card.title }, lesson, place, base) }
}
