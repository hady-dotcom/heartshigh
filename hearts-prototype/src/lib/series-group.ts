/**
 * Group the library into multi-talk courses: numbered Names classes, Prophet sessions,
 * and other titled series. Only numbered sessions of the same series and speaker.
 * Short clips stay out of a long series. Leftover long talks are never bundled.
 * Pure: no writes. Applying groups is gated by HEARTS_GROUP_SERIES.
 */

export const LONG_MAIN_SECONDS = 600
export const GENUINE_MAIN_SECONDS = 1200
export const GROUP_SERIES_FLAG = 'HEARTS_GROUP_SERIES'
export const DEMOTE_SHORT_MAINS_FLAG = 'HEARTS_DEMOTE_SHORT_MAINS'

export type LibraryLesson = {
  id: number
  title: string
  courseId: number
  courseTitle: string
  durationSeconds: number
  youtubeId?: string
  series?: string | null
  order?: number
  speaker?: string | null
}

export type SeriesGroup = {
  key: string
  title: string
  lessonIds: number[]
  seconds: number[]
  speaker: string
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
  shortMains: { courseTitle: string; lessonTitle: string; seconds: number; proposeAs: 'clip' | 'ready-for-more' }[]
  emptyCourses: { id: number; title: string }[]
}

const PROPHET = /how to live like the prophet/i
const NAMES_CLASS = /the names class\s*\d+/i
const SHORT_CLIP = /short clip/i
const NUMBERED = /(?:session|class|episode|ep\.?|part|day)\s*\d+/i

type FlagEnv = Record<string, string | undefined>

export function groupSeriesEnabled(env: FlagEnv = process.env) {
  return env[GROUP_SERIES_FLAG] === '1'
}

/** Off unless HEARTS_DEMOTE_SHORT_MAINS=1 or HEARTS_GROUP_SERIES=1. Nothing is written when it is off. */
export function demoteShortMainsEnabled(env: FlagEnv = process.env) {
  return env[DEMOTE_SHORT_MAINS_FLAG] === '1' || env[GROUP_SERIES_FLAG] === '1'
}

export function shortMainThreshold(env: FlagEnv = process.env) {
  return demoteShortMainsEnabled(env) ? GENUINE_MAIN_SECONDS : LONG_MAIN_SECONDS
}

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

function speakerKey(speaker?: string | null) {
  return (speaker || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

/** Series key from an explicit field or a numbered title. Short clips stay in their own group. */
export function seriesKey(title: string, explicit?: string | null): string | null {
  const named = (explicit || '').trim()
  if (SHORT_CLIP.test(`${named} ${title}`)) return 'The Names: short clips'
  if (PROPHET.test(title) || PROPHET.test(named)) return 'How to Live Like the Prophet'
  if (NAMES_CLASS.test(title) || (/^the names$/i.test(named) && !SHORT_CLIP.test(named))) return 'The Names'
  if (named && NUMBERED.test(title)) return named
  const numbered = title.match(/^(.*?)(?:,\s*|\s+)(?:session|class|episode|ep\.?|part|day)\s*\d+/i)
  const stem = numbered?.[1]?.replace(/\s*[|–—:]+$/g, '').trim()
  if (stem && stem.length >= 8) return stem
  return null
}

export function isLongMain(seconds: number) {
  return seconds >= LONG_MAIN_SECONDS
}

/**
 * Plan course moves from the current library. Series of two or more long talks
 * that share a series name and a speaker share a course. Short clips never join.
 * Leftover long talks stay where they are. Nothing is written.
 */
export function planSeriesMoves(lessons: LibraryLesson[]): SeriesPlan {
  const byKey = new Map<string, LibraryLesson[]>()
  for (const lesson of lessons) {
    const key = seriesKey(lesson.title, lesson.series)
    const speaker = speakerKey(lesson.speaker)
    if (!key || SHORT_CLIP.test(key) || !speaker) continue
    if (!NUMBERED.test(lesson.title) && !NUMBERED.test(lesson.series || '')) continue
    if (!isLongMain(lesson.durationSeconds)) continue
    const mapKey = `${key}::${speaker}`
    const list = byKey.get(mapKey) || []
    list.push(lesson)
    byKey.set(mapKey, list)
  }

  const groups: SeriesGroup[] = []
  const claimed = new Set<number>()
  const moves: SeriesMove[] = []

  for (const [mapKey, own] of [...byKey.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (own.length < 2) continue
    const speakers = new Set(own.map((row) => speakerKey(row.speaker)).filter(Boolean))
    if (speakers.size !== 1) continue
    const key = mapKey.split('::')[0]
    const ordered = [...own].sort((a, b) => (a.order || 0) - (b.order || 0) || a.id - b.id)
    groups.push({
      key,
      title: key,
      lessonIds: ordered.map((row) => row.id),
      seconds: ordered.map((row) => row.durationSeconds),
      speaker: ordered[0]?.speaker?.trim() || '',
    })
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
        reason: `Numbered sittings of ${key} by the same speaker.`,
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

  const shortLimit = shortMainThreshold()
  const shortMains: SeriesPlan['shortMains'] = []
  for (const [title, own] of after) {
    if (SHORT_CLIP.test(title)) continue
    for (const lesson of own) {
      if (lesson.durationSeconds > 0 && lesson.durationSeconds < shortLimit && !SHORT_CLIP.test(`${title} ${lesson.title}`)) {
        shortMains.push({
          courseTitle: title,
          lessonTitle: lesson.title,
          seconds: lesson.durationSeconds,
          proposeAs: lesson.durationSeconds < 180 ? 'clip' : 'ready-for-more',
        })
      }
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
    shortMains: shortMains.sort((a, b) => a.courseTitle.localeCompare(b.courseTitle) || a.lessonTitle.localeCompare(b.lessonTitle)),
    emptyCourses: [...emptied.entries()].map(([id, title]) => ({ id, title })),
  }
}
