import { idOf } from './ids'
import { countsTowardProgress, pieceLevel } from './progress'

type LessonRef = { lesson?: unknown; sourceLevel?: unknown; seconds?: unknown; [key: string]: unknown }

/** Distinct talks that have a completion or a sitting with real played seconds. */
export function watchedLessonIds(input: { completions: LessonRef[]; sessions: LessonRef[] }) {
  const ids = new Set<number>()
  for (const row of input.completions) {
    const id = idOf(row.lesson)
    if (id) ids.add(id)
  }
  for (const row of input.sessions) {
    const id = idOf(row.lesson)
    if (id && Number(row.seconds || 0) > 0) ids.add(id)
  }
  return ids
}

/**
 * Full-talk completions that sit inside a course. A talk completion still counts when the lesson
 * was missing from an older visit snapshot, as long as we now know it has a course.
 */
export function countedTalkCompletions<T extends LessonRef>(input: {
  completions: T[]
  courseByLesson: Map<number, number | null | undefined>
}) {
  return input.completions.filter((row) => {
    const lessonId = idOf(row.lesson)
    const courseId = lessonId ? input.courseByLesson.get(lessonId) : null
    return countsTowardProgress({
      level: pieceLevel(row.sourceLevel),
      inCourse: Boolean(courseId),
      event: 'watch',
    })
  })
}

/** The day a sitting or answer counts on Garden, preferring the moment it happened. */
export function activityDay(row: { watchedAt?: unknown; answeredAt?: unknown; createdAt?: unknown }) {
  const raw = row.watchedAt || row.answeredAt || row.createdAt
  return typeof raw === 'string' ? raw.slice(0, 10) : ''
}

export type PathTalk = { id: number; title: string; href: string; done: boolean }

/**
 * Your path is this course only, in course order.
 * A talk the learner has sat with on another course stays off this list.
 * Finished counts those sittings separately.
 */
export function gardenPathNodes(watched: PathTalk[], courseLessons: PathTalk[]) {
  const watchedDone = new Set(watched.filter((row) => row.done).map((row) => row.id))
  const ordered: PathTalk[] = []
  const seen = new Set<number>()
  for (const lesson of courseLessons) {
    if (!lesson.id || seen.has(lesson.id)) continue
    seen.add(lesson.id)
    ordered.push(watchedDone.has(lesson.id) ? { ...lesson, done: true } : lesson)
  }
  const firstOpen = ordered.find((row) => !row.done)
  return ordered.map((row) => ({
    id: row.id,
    title: row.title,
    href: row.href,
    state: (row.done ? 'done' : row.id === firstOpen?.id ? 'active' : 'next') as 'done' | 'active' | 'next',
  }))
}

/** Light a Jibril section when a sitting (or an answer) sits on a cut's door. */
export function doorsLitByCuts(input: {
  cuts: { lesson?: unknown; bestClause?: unknown; [key: string]: unknown }[]
  watched: Set<number>
  done: Set<number>
  answered?: Set<number>
  doorOf: (clause: number) => number | null
}) {
  const lit = new Set<number>()
  const activityLit = new Set<number>()
  for (const cut of input.cuts) {
    const lessonId = idOf(cut.lesson)
    const door = input.doorOf(Number(cut.bestClause || 0))
    if (!lessonId || !door) continue
    if (input.watched.has(lessonId) || input.answered?.has(lessonId)) activityLit.add(door)
    if (input.done.has(lessonId)) lit.add(door)
  }
  return { lit, activityLit }
}

/** Lesson ids to load so a completion or sitting can be placed in its course. */
export function growthLessonIds(input: { completions: LessonRef[]; visits: LessonRef[]; answers: LessonRef[]; sessions: LessonRef[] }) {
  const ids = new Set<number>()
  for (const row of [...input.completions, ...input.visits, ...input.answers, ...input.sessions]) {
    const id = idOf(row.lesson)
    if (id) ids.add(id)
  }
  return [...ids]
}
