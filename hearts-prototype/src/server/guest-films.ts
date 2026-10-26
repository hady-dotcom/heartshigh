import type { Payload } from 'payload'
import { guestDescription, knownSeconds, type GuestFilm, type GuestNext } from '@/lib/guest-film'
import { filmCanPlay } from '@/lib/film-availability'
import { sortParts } from '@/lib/part-order'
import { asLessonVisibility, learnerLessonVisible } from '@/lib/publish-state'
import { fetchVimeoMeta, shouldFetchVimeo } from '@/lib/vimeo-meta'
import { rows, str, ref } from '@/screens/common'
import { filmPoster, shownPoster } from '@/server/learner'

const HEX = /^[0-9a-f]{6,20}$/i
const STILL_MS = 60 * 60 * 1000

type CourseRow = { id: number; title?: string | null; hidden?: boolean | null; visibility?: string | null; summary?: string | null }
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
  durationSeconds?: number | null
  transcript?: string | null
}

type Ordered = { lesson: LessonRow; place: number }
type NextDraft = GuestNext & { vimeoId: string; vimeoHash: string | null }
type FilmDraft = GuestFilm & { upNext: NextDraft[]; courseSummary: string }

export type GuestCourseCard = {
  id: number
  title: string
  count: number
  href: string
  listHref: string
  poster: string | null
  place: number
  filmTitle: string
}

export type GuestCatalogFilm = {
  lessonId: number
  title: string
  place: number
  poster: string | null
  href: string
  seconds: number | null
  playable: boolean
}

const stillCache = new Map<string, { poster: string; seconds: number; at: number }>()

function guidingFirst(title: string) {
  return /guid|home learning/i.test(title) ? 0 : 1
}

function hashOf(lesson: LessonRow) {
  const hash = str(lesson.vimeoHash).trim()
  return HEX.test(hash) ? hash : null
}

function toNext(course: CourseRow, row: Ordered, base: string): NextDraft {
  return {
    lessonId: row.lesson.id,
    title: str(row.lesson.title) || str(row.lesson.sourceTitle) || 'Film',
    place: row.place,
    poster: shownPoster(filmPoster(row.lesson)),
    href: `${base}/course/${course.id}?part=${row.lesson.id}`,
    seconds: knownSeconds(row.lesson.durationSeconds),
    vimeoId: str(row.lesson.vimeoId).trim(),
    vimeoHash: hashOf(row.lesson),
  }
}

function buildFilm(course: CourseRow, ordered: Ordered[], current: Ordered, base: string): FilmDraft {
  const hash = hashOf(current.lesson)
  const youtubeId = str(current.lesson.youtubeId).trim()
  const playable = ordered.filter((row) => filmCanPlay(row.lesson))
  const at = playable.findIndex((row) => row.lesson.id === current.lesson.id)
  const upNext = playable.slice(at < 0 ? 0 : at + 1, (at < 0 ? 0 : at + 1) + 3).map((row) => toNext(course, row, base))
  return {
    courseId: course.id,
    courseTitle: str(course.title),
    lessonId: current.lesson.id,
    title: str(current.lesson.title) || str(current.lesson.sourceTitle) || 'Film',
    place: current.place,
    poster: shownPoster(filmPoster(current.lesson)),
    description: guestDescription({
      transcript: current.lesson.transcript,
      summary: course.summary,
      place: current.place,
      count: ordered.length,
      courseTitle: str(course.title),
    }),
    seconds: knownSeconds(current.lesson.durationSeconds),
    filmCount: ordered.length,
    vimeoId: str(current.lesson.vimeoId).trim(),
    vimeoHash: hash,
    youtubeId: /^[\w-]{11}$/.test(youtubeId) ? youtubeId : null,
    href: `${base}/course/${course.id}?part=${current.lesson.id}`,
    coursesHref: `${base}/courses`,
    listHref: `${base}/course/${course.id}`,
    upNext,
    courseSummary: str(course.summary),
  }
}

async function stillFor(id: string, hash: string | null) {
  const key = `${id}:${hash || ''}`
  const cached = stillCache.get(key)
  if (cached && Date.now() - cached.at < STILL_MS) return cached
  const meta = await fetchVimeoMeta(id, fetch, hash || '')
  if (!meta) return null
  const row = { poster: meta.posterUrl, seconds: meta.durationSeconds, at: Date.now() }
  stillCache.set(key, row)
  return row
}

/** Fill a missing Vimeo poster and length. Skipped in tests, where the stored still is enough. */
export async function paintGuestFilm(draft: FilmDraft): Promise<GuestFilm> {
  const nextDrafts = draft.upNext as NextDraft[]
  const film: GuestFilm = {
    courseId: draft.courseId,
    courseTitle: draft.courseTitle,
    lessonId: draft.lessonId,
    title: draft.title,
    place: draft.place,
    poster: draft.poster,
    description: draft.description,
    seconds: draft.seconds,
    filmCount: draft.filmCount,
    vimeoId: draft.vimeoId,
    vimeoHash: draft.vimeoHash,
    youtubeId: draft.youtubeId,
    href: draft.href,
    coursesHref: draft.coursesHref,
    listHref: draft.listHref,
    upNext: nextDrafts.map(({ vimeoId: _id, vimeoHash: _hash, ...row }) => row),
  }
  if (!shouldFetchVimeo()) return film
  const work: Promise<void>[] = []
  if (draft.vimeoId && (!film.poster || film.seconds == null)) {
    work.push(stillFor(draft.vimeoId, draft.vimeoHash).then((still) => {
      if (!still) return
      if (!film.poster && still.poster) film.poster = still.poster
      if (film.seconds == null) film.seconds = knownSeconds(still.seconds)
    }).catch(() => undefined))
  }
  nextDrafts.forEach((row, index) => {
    const next = film.upNext[index]
    if (!row.vimeoId || !next || (next.poster && next.seconds != null)) return
    work.push(stillFor(row.vimeoId, row.vimeoHash).then((still) => {
      if (!still || !next) return
      if (!next.poster && still.poster) next.poster = still.poster
      if (next.seconds == null) next.seconds = knownSeconds(still.seconds)
    }).catch(() => undefined))
  })
  if (!work.length) return film
  await Promise.race([
    Promise.all(work),
    new Promise((resolve) => setTimeout(resolve, 4000)),
  ])
  return film
}

function orderedLessons(lessons: LessonRow[], courseId: number) {
  return sortParts(lessons.filter((lesson) => ref(lesson.course) === courseId)).map((lesson, index) => ({ lesson, place: index + 1 }))
}

/** Local courses on this portal, in teaching order, with the first film that can play. */
export async function guestLibrary(payload: Payload, portalId: number, base: string) {
  const courses = (await rows(payload, 'courses', { portal: { equals: portalId } }, { limit: 40 }) as CourseRow[])
    .filter((course) => course.hidden !== true && str(course.visibility) !== 'draft')
    .sort((a, b) => guidingFirst(str(a.title)) - guidingFirst(str(b.title)) || a.id - b.id)
  const ids = courses.map((course) => course.id)
  if (!ids.length) return { first: null as FilmDraft | null, courses: [] as GuestCourseCard[], films: new Map<number, FilmDraft>(), lists: new Map<number, GuestCatalogFilm[]>() }
  const lessons = (await rows(payload, 'lessons', { course: { in: ids } }, { sort: 'order', limit: 500 })) as LessonRow[]
  const visible = lessons.filter((lesson) => learnerLessonVisible(asLessonVisibility(lesson)))
  const cards: GuestCourseCard[] = []
  const films = new Map<number, FilmDraft>()
  const lists = new Map<number, GuestCatalogFilm[]>()
  let first: FilmDraft | null = null
  for (const course of courses) {
    const ordered = orderedLessons(visible, course.id)
    const playable = ordered.filter(({ lesson }) => filmCanPlay(lesson))
    if (!playable.length) continue
    const vimeo = playable.find(({ lesson }) => str(lesson.vimeoId).trim())
    const start = vimeo || playable.find(({ lesson }) => str(lesson.youtubeId).trim()) || playable[0]
    const film = buildFilm(course, ordered, start, base)
    films.set(course.id, film)
    if (!first && film.vimeoId) first = film
    const poster = shownPoster(ordered.map(({ lesson }) => filmPoster(lesson)).find(Boolean) || null)
    lists.set(course.id, ordered.map((row) => ({
      lessonId: row.lesson.id,
      title: str(row.lesson.title) || str(row.lesson.sourceTitle) || 'Film',
      place: row.place,
      poster: shownPoster(filmPoster(row.lesson)),
      href: `${base}/course/${course.id}?part=${row.lesson.id}`,
      seconds: knownSeconds(row.lesson.durationSeconds),
      playable: filmCanPlay(row.lesson),
    })))
    cards.push({
      id: course.id,
      title: str(course.title) || 'Course',
      count: ordered.length,
      href: film.href,
      listHref: `${base}/course/${course.id}`,
      poster,
      place: start.place,
      filmTitle: film.title,
    })
  }
  if (!first) first = films.values().next().value || null
  return { first, courses: cards, films, lists }
}

export async function guestCourseCatalog(payload: Payload, portalId: number, base: string, courseId: number) {
  const library = await guestLibrary(payload, portalId, base)
  const card = library.courses.find((course) => course.id === courseId)
  const films = library.lists.get(courseId)
  if (!card || !films) return null
  return { card, films }
}

export async function firstGuestFilm(payload: Payload, portalId: number, base: string) {
  const film = (await guestLibrary(payload, portalId, base)).first
  return film ? paintGuestFilm(film) : null
}

export async function guestCourseFilm(payload: Payload, portalId: number, base: string, courseId: number, partId?: number) {
  const library = await guestLibrary(payload, portalId, base)
  const card = library.courses.find((course) => course.id === courseId)
  const film = library.films.get(courseId)
  if (!card || !film) return null
  if (!partId || partId === film.lessonId) return { card, film: await paintGuestFilm(film) }
  const lessons = (await rows(payload, 'lessons', { course: { equals: courseId } }, { sort: 'order', limit: 500 })) as LessonRow[]
  const ordered = orderedLessons(lessons.filter((row) => learnerLessonVisible(asLessonVisibility(row))), courseId)
  const current = ordered.find((row) => row.lesson.id === partId)
  if (!current || !filmCanPlay(current.lesson)) return { card, film: await paintGuestFilm(film) }
  return { card, film: await paintGuestFilm(buildFilm({ id: courseId, title: card.title, summary: film.courseSummary }, ordered, current, base)) }
}
