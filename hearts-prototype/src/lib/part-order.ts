/** Course parts follow the talk's own sequence at read time. */

export type PartLesson = {
  id: number
  title?: string | null
  sourceTitle?: string | null
  order?: number | null
  episode?: number | null
  episodeOrder?: number | null
  partNumber?: number | null
  partOrder?: number | null
  publishedAt?: string | null
  youtubePublishedAt?: string | null
  uploadedAt?: string | null
}

const TALK_NUMBER = /(?:\[)?\b(?:ep(?:isode)?\.?|part|session|class|day)\s*(\d+)\b/i

function firstPositive(...values: unknown[]) {
  for (const value of values) {
    const number = Number(value)
    if (Number.isFinite(number) && number > 0) return number
  }
  return null
}

function compareOptional(a: number | null, b: number | null) {
  if (a != null && b != null && a !== b) return a - b
  return 0
}

/** An explicit episode/part field on the row, if one was stored. Not the lesson `order` field. */
export function explicitTalkOrder(lesson: PartLesson) {
  return firstPositive(lesson.episodeOrder, lesson.partOrder, lesson.episode, lesson.partNumber)
}

/** Episode number from titles like `[Ep 2]`, `Ep. 1`, `Part 3`, or `Session 6`. */
export function talkSequenceNumber(title?: string | null) {
  if (!title) return null
  const match = TALK_NUMBER.exec(title)
  return match ? Number(match[1]) : null
}

function sequenceOf(lesson: PartLesson) {
  return talkSequenceNumber(lesson.title) ?? talkSequenceNumber(lesson.sourceTitle)
}

function publishedTime(lesson: PartLesson) {
  for (const value of [lesson.youtubePublishedAt, lesson.publishedAt, lesson.uploadedAt]) {
    if (!value) continue
    const time = Date.parse(String(value))
    if (Number.isFinite(time)) return time
  }
  return null
}

/**
 * Prefer an explicit episode field, then a number parsed from the title, then the
 * YouTube publish date, then the stored lesson order (creation / importer order).
 * Display numbering stays 1, 2, 3 from this list.
 */
export function sortParts<T extends PartLesson>(
  lessons: T[],
  unitRank: (row: T) => number = () => 0,
) {
  return [...lessons].sort((a, b) => (
    compareOptional(explicitTalkOrder(a), explicitTalkOrder(b))
    || compareOptional(sequenceOf(a), sequenceOf(b))
    || compareOptional(publishedTime(a), publishedTime(b))
    || (Number(a.order) || 0) - (Number(b.order) || 0)
    || unitRank(a) - unitRank(b)
    || a.id - b.id
  ))
}

export type ReversedCourse<T extends PartLesson> = {
  title: string
  current: T[]
  talk: T[]
}

/** Multi-part courses whose stored order disagrees with the talk sequence. */
export function reversedTalkCourses<T extends PartLesson>(
  courses: { title: string; lessons: T[] }[],
) {
  const found: ReversedCourse<T>[] = []
  for (const course of courses) {
    if (course.lessons.length < 2) continue
    const current = [...course.lessons].sort(
      (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || a.id - b.id,
    )
    const talk = sortParts(course.lessons)
    if (current.some((lesson, index) => lesson.id !== talk[index]?.id)) {
      found.push({ title: course.title, current, talk })
    }
  }
  return found
}
