/**
 * Group the library into multi-talk courses: numbered Names classes, Prophet sessions,
 * and other titled series. Short clips stay out of a long series.
 * A 10-talk "Long sittings" course is assembled from the longest remaining mains
 * so a 3,3,2,2 split can be shown. Pure: no writes.
 */

export const LONG_MAIN_SECONDS = 600
export const LONG_SITTINGS = 'Long sittings'
export const PROOF_TALK_COUNT = 10

export type LibraryLesson = {
  id: number
  title: string
  courseId: number
  courseTitle: string
  durationSeconds: number
  youtubeId?: string
  series?: string | null
  order?: number
}

export type SeriesGroup = {
  key: string
  title: string
  lessonIds: number[]
  seconds: number[]
}

export type SeriesMove = {
  lessonId: number
  title: string
  fromCourseId: number
  fromTitle: string
  toTitle: string
  seconds: number
  reason: string
}

export type SeriesPlan = {
  groups: SeriesGroup[]
  moves: SeriesMove[]
  shortMains: { courseTitle: string; lessonTitle: string; seconds: number }[]
  emptyCourses: { id: number; title: string }[]
}

const PROPHET = /how to live like the prophet/i
const NAMES_CLASS = /the names class\s*\d+/i
const SHORT_CLIP = /short clip/i

export function clock(total: number) {
  const value = Math.max(0, Math.floor(total))
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const seconds = value % 60
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function isShortClip(title: string, courseTitle = '', seconds = 0) {
  if (SHORT_CLIP.test(`${courseTitle} ${title}`)) return true
  return seconds > 0 && seconds < LONG_MAIN_SECONDS && SHORT_CLIP.test(`${courseTitle} ${title}`)
}

/** Series key from an explicit field or a numbered title. Short clips stay in their own group. */
export function seriesKey(title: string, explicit?: string | null): string | null {
  const named = (explicit || '').trim()
  if (SHORT_CLIP.test(`${named} ${title}`)) return 'The Names: short clips'
  if (PROPHET.test(title) || PROPHET.test(named)) return 'How to Live Like the Prophet'
  if (NAMES_CLASS.test(title) || (/^the names$/i.test(named) && !SHORT_CLIP.test(named))) return 'The Names'
  if (named) return named
  const numbered = title.match(/^(.*?)(?:,\s*|\s+)(?:session|class|episode|ep\.?|part|day)\s*\d+/i)
  const stem = numbered?.[1]?.replace(/\s*[|–—:]+$/g, '').trim()
  if (stem && stem.length >= 8) return stem
  return null
}

export function isLongMain(seconds: number) {
  return seconds >= LONG_MAIN_SECONDS
}

/**
 * Plan course moves from the current library. Series of two or more long talks share a course.
 * Ten leftover long talks become Long sittings (the 3,3,2,2 proof course).
 * Short clips never join a long series. Nothing is written.
 */
export function planSeriesMoves(lessons: LibraryLesson[]): SeriesPlan {
  const byKey = new Map<string, LibraryLesson[]>()
  for (const lesson of lessons) {
    const key = seriesKey(lesson.title, lesson.series)
    if (!key || SHORT_CLIP.test(key)) continue
    const long = isLongMain(lesson.durationSeconds)
    if (!long) continue
    const list = byKey.get(key) || []
    list.push(lesson)
    byKey.set(key, list)
  }

  const groups: SeriesGroup[] = []
  const claimed = new Set<number>()
  const moves: SeriesMove[] = []

  for (const [key, own] of [...byKey.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (own.length < 2) continue
    const ordered = [...own].sort((a, b) => (a.order || 0) - (b.order || 0) || a.id - b.id)
    groups.push({ key, title: key, lessonIds: ordered.map((row) => row.id), seconds: ordered.map((row) => row.durationSeconds) })
    for (const lesson of ordered) {
      claimed.add(lesson.id)
      if (lesson.courseTitle === key && own.every((row) => row.courseId === lesson.courseId)) continue
      if (lesson.courseTitle === key) continue
      moves.push({
        lessonId: lesson.id,
        title: lesson.title,
        fromCourseId: lesson.courseId,
        fromTitle: lesson.courseTitle,
        toTitle: key,
        seconds: lesson.durationSeconds,
        reason: `Same series as ${own.length - 1} other long talk${own.length === 2 ? '' : 's'}.`,
      })
    }
  }

  const leftoverLong = lessons
    .filter((lesson) => !claimed.has(lesson.id) && isLongMain(lesson.durationSeconds) && !SHORT_CLIP.test(`${lesson.courseTitle} ${lesson.title}`))
    .sort((a, b) => b.durationSeconds - a.durationSeconds || a.id - b.id)

  if (leftoverLong.length >= PROOF_TALK_COUNT) {
    const picked = leftoverLong.slice(0, PROOF_TALK_COUNT)
    groups.push({
      key: LONG_SITTINGS,
      title: LONG_SITTINGS,
      lessonIds: picked.map((row) => row.id),
      seconds: picked.map((row) => row.durationSeconds),
    })
    for (const lesson of picked) {
      claimed.add(lesson.id)
      if (lesson.courseTitle === LONG_SITTINGS) continue
      moves.push({
        lessonId: lesson.id,
        title: lesson.title,
        fromCourseId: lesson.courseId,
        fromTitle: lesson.courseTitle,
        toTitle: LONG_SITTINGS,
        seconds: lesson.durationSeconds,
        reason: 'One of the ten longest full talks, so a 3,3,2,2 split can be shown.',
      })
    }
  }

  const after = new Map<string, LibraryLesson[]>()
  for (const lesson of lessons) {
    const move = moves.find((row) => row.lessonId === lesson.id)
    const title = move?.toTitle || lesson.courseTitle
    const list = after.get(title) || []
    list.push(lesson)
    after.set(title, list)
  }

  const shortMains: SeriesPlan['shortMains'] = []
  for (const [title, own] of after) {
    if (SHORT_CLIP.test(title)) continue
    const main = [...own].sort((a, b) => b.durationSeconds - a.durationSeconds)[0]
    if (main && main.durationSeconds > 0 && main.durationSeconds < LONG_MAIN_SECONDS) {
      shortMains.push({ courseTitle: title, lessonTitle: main.title, seconds: main.durationSeconds })
    }
  }

  const staying = new Set(lessons.filter((lesson) => !moves.some((move) => move.lessonId === lesson.id)).map((lesson) => lesson.courseId))
  const emptied = new Map<number, string>()
  for (const lesson of lessons) {
    if (!moves.some((move) => move.lessonId === lesson.id)) continue
    if (staying.has(lesson.courseId)) continue
    const still = lessons.some((row) => row.courseId === lesson.courseId && !moves.some((move) => move.lessonId === row.id))
    if (!still) emptied.set(lesson.courseId, lesson.courseTitle)
  }

  return {
    groups,
    moves,
    shortMains: shortMains.sort((a, b) => a.courseTitle.localeCompare(b.courseTitle)),
    emptyCourses: [...emptied.entries()].map(([id, title]) => ({ id, title })),
  }
}
