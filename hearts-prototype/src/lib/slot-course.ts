import { idOf } from './ids'

export type SlotCourseInput = {
  lessonCourse?: unknown
  slotCourseId?: number | null
  planCourseId?: number | null
}

/** A sitting opens in the talk's own course. The plan course is only a fallback. */
export function slotCourseId(input: SlotCourseInput) {
  return idOf(input.lessonCourse) || input.slotCourseId || input.planCourseId || null
}

export function slotHref(base: string, lessonId: number | null | undefined, courseId: number | null) {
  if (!lessonId || !courseId) return null
  return `${base}/course/${courseId}?part=${lessonId}`
}

/** Keep each course's own order when a pack spans more than one course. */
export function lessonsByCourseOrder<T extends { course?: unknown }>(lessons: T[], courseIds: number[]) {
  if (courseIds.length <= 1) return lessons
  const buckets = new Map<number, T[]>()
  for (const id of courseIds) buckets.set(id, [])
  for (const lesson of lessons) {
    const courseId = idOf(lesson.course)
    if (courseId && buckets.has(courseId)) buckets.get(courseId)!.push(lesson)
  }
  return courseIds.flatMap((id) => buckets.get(id) || [])
}
