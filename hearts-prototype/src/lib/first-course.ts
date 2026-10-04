/**
 * The first course a learner is offered: part 1 of a series, or a self-contained talk.
 * Never Session N / Part N with N greater than 1, and not a talk aimed at one life stage.
 */

export const LIFE_STAGE = /\b(mahr|marriage|nikah|wedding|walima|wife|husband|spouse|dowry)\b/i
export const SERIES_PART = /\b(?:session|part|lesson|ep(?:isode)?)\s*(\d+)\b/i

export function seriesPartNumber(title: string): number | null {
  const match = SERIES_PART.exec(title)
  return match ? Number(match[1]) : null
}

export function isLifeStageTopic(title: string): boolean {
  return LIFE_STAGE.test(title)
}

/** A gentle opening: not a later part, and not a talk for one life stage. */
export function isGentleOpening(title: string): boolean {
  const part = seriesPartNumber(title)
  if (part != null && part > 1) return false
  return !isLifeStageTopic(title)
}

export type FirstLesson = { id: number; title: string; order: number }
export type FirstCourse = { courseId: number; courseTitle: string; lessons: FirstLesson[] }

export type FirstPick = {
  courseId: number
  lessonId: number
  courseTitle: string
  lessonTitle: string
  reason: string
}

function firstLessonOf(course: FirstCourse): FirstLesson | null {
  if (!course.lessons.length) return null
  return [...course.lessons].sort((a, b) => (a.order || 0) - (b.order || 0) || a.id - b.id)[0]
}

function courseOfLesson(courses: FirstCourse[], lessonId: number | null): FirstCourse | null {
  if (!lessonId) return null
  return courses.find((course) => course.lessons.some((lesson) => lesson.id === lessonId)) || null
}

/**
 * After a door has pointed at a sitting, walk to that course's first talk when the hit was a later session,
 * or to another course in the same list when the first talk is aimed at one life stage.
 */
export function pickGentleFirstCourse(recommendedLessonId: number | null, courses: FirstCourse[]): FirstPick | null {
  const hit = courseOfLesson(courses, recommendedLessonId)
  const ordered = hit ? [hit, ...courses.filter((course) => course.courseId !== hit.courseId)] : courses
  for (const course of ordered) {
    const first = firstLessonOf(course)
    if (!first) continue
    const title = `${course.courseTitle} ${first.title}`
    if (!isGentleOpening(title) && !isGentleOpening(first.title)) continue
    const moved = hit && course.courseId === hit.courseId && recommendedLessonId && first.id !== recommendedLessonId
    return {
      courseId: course.courseId,
      lessonId: first.id,
      courseTitle: course.courseTitle,
      lessonTitle: first.title,
      reason: moved
        ? `The door pointed at a later sitting. Offering part 1 of ${course.courseTitle} instead.`
        : `Part 1 of ${course.courseTitle}.`,
    }
  }
  const fallback = firstLessonOf(hit || courses[0] || { courseId: 0, courseTitle: '', lessons: [] })
  const course = hit || courses[0]
  if (!fallback || !course) return null
  return {
    courseId: course.courseId,
    lessonId: fallback.id,
    courseTitle: course.courseTitle,
    lessonTitle: fallback.title,
    reason: 'No gentler part 1 was in this door, so the first talk of the matched course is used.',
  }
}

/** When the library's earliest numbered sitting is not 1. */
export function libraryStartNote(titles: string[]): string | null {
  const numbers = titles.map((title) => seriesPartNumber(title)).filter((value): value is number => value != null)
  if (!numbers.length) return null
  const earliest = Math.min(...numbers)
  if (earliest <= 1) return null
  return `Our library starts this course at Lesson ${earliest}.`
}
