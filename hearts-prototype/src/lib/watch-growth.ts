import { idOf } from './ids'
import { countsTowardProgress, pieceLevel } from './progress'

type LessonRef = { lesson?: unknown; sourceLevel?: unknown; seconds?: unknown }

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

/** Lesson ids to load so a completion or sitting can be placed in its course. */
export function growthLessonIds(input: { completions: LessonRef[]; visits: LessonRef[]; answers: LessonRef[]; sessions: LessonRef[] }) {
  const ids = new Set<number>()
  for (const row of [...input.completions, ...input.visits, ...input.answers, ...input.sessions]) {
    const id = idOf(row.lesson)
    if (id) ids.add(id)
  }
  return [...ids]
}
