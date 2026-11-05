import { learnerLessonVisible } from '@/lib/publish-state'

export type TalkLessonRow = {
  id: number
  courseId: number
  publishState?: string | null
  transcriptNote?: string | null
  tooShort?: boolean | null
}

/**
 * Whether Full talk may open this part.
 * The course page 404s when the course row is missing, and a part id that is not
 * one of that course's visible lessons would open a different talk. Either way
 * the feed stays put and says there is no full talk.
 */
export function talkPartOpen(input: { courseId: number; lessonId: number; courseExists: boolean; lesson: TalkLessonRow | null }) {
  const courseId = Number(input.courseId)
  const lessonId = Number(input.lessonId)
  if (!input.courseExists || !Number.isFinite(courseId) || courseId <= 0 || !Number.isFinite(lessonId) || lessonId <= 0) return false
  const lesson = input.lesson
  if (!lesson || lesson.id !== lessonId || lesson.courseId !== courseId) return false
  return learnerLessonVisible(lesson)
}
