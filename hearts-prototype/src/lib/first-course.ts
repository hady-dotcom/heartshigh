/**
 * The first course a learner is offered: a long on-topic talk, preferably the earliest
 * sitting of that series in the library. Never walk from a full talk to a short clip.
 * Walking back stays inside this door's topic. A constructed buffet is not a series.
 */

import { seriesKey } from './series-group'

export const LIFE_STAGE = /\b(mahr|marriage|nikah|wedding|walima|wife|husband|spouse|dowry)\b/i
export const SERIES_PART = /\b(?:session|part|lesson|class|ep(?:isode)?)\s*(\d+)\b/i
export const SHORT_CLIP = /short clip/i
export const LONG_OPENING_SECONDS = 600

export function seriesPartNumber(title: string): number | null {
  const match = SERIES_PART.exec(title)
  return match ? Number(match[1]) : null
}

export function isLifeStageTopic(title: string): boolean {
  return LIFE_STAGE.test(title)
}

export function isShortClipTitle(title: string): boolean {
  return SHORT_CLIP.test(title)
}

function secondsOf(lesson: { durationSeconds?: number | null }): number {
  return Number(lesson.durationSeconds || 0)
}

export function isLongTalk(lesson: { durationSeconds?: number | null; title?: string }, courseTitle = ''): boolean {
  if (isShortClipTitle(`${courseTitle} ${lesson.title || ''}`)) return false
  const seconds = secondsOf(lesson)
  if (seconds > 0 && seconds < LONG_OPENING_SECONDS) return false
  return true
}

/** A gentle opening: not a later part when an earlier one exists, and not a talk for one life stage. */
export function isGentleOpening(title: string): boolean {
  const part = seriesPartNumber(title)
  if (part != null && part > 1) return false
  return !isLifeStageTopic(title)
}

export type FirstLesson = { id: number; title: string; order: number; durationSeconds?: number }
export type FirstCourse = { courseId: number; courseTitle: string; lessons: FirstLesson[] }

export type FirstPick = {
  courseId: number
  lessonId: number
  courseTitle: string
  lessonTitle: string
  reason: string
}

function earliestNumber(course: FirstCourse): number | null {
  const numbers = course.lessons.map((lesson) => seriesPartNumber(lesson.title)).filter((value): value is number => value != null)
  return numbers.length ? Math.min(...numbers) : null
}

function pickOf(course: FirstCourse, lesson: FirstLesson, reason: string): FirstPick {
  return {
    courseId: course.courseId,
    lessonId: lesson.id,
    courseTitle: course.courseTitle,
    lessonTitle: lesson.title,
    reason,
  }
}

function sameSeries(lessonTitle: string, otherTitle: string) {
  const key = seriesKey(lessonTitle)
  const other = seriesKey(otherTitle)
  if (key && other) return key === other
  return false
}

function seriesSiblings(course: FirstCourse, lesson: FirstLesson): FirstLesson[] {
  const key = seriesKey(lesson.title)
  if (!key) return [lesson]
  const own = course.lessons.filter((row) => seriesKey(row.title) === key)
  return own.length ? own : [lesson]
}

function earliestLongLesson(course: FirstCourse, within?: FirstLesson[]): FirstLesson | null {
  const long = (within || course.lessons).filter((lesson) => isLongTalk(lesson, course.courseTitle))
  if (!long.length) return null
  const earliest = earliestNumber({ ...course, lessons: long })
  return [...long].sort((a, b) => {
    const aPart = seriesPartNumber(a.title)
    const bPart = seriesPartNumber(b.title)
    if (earliest != null && aPart === earliest && bPart !== earliest) return -1
    if (earliest != null && bPart === earliest && aPart !== earliest) return 1
    return (a.order || 0) - (b.order || 0) || a.id - b.id
  })[0]
}

function courseOfLesson(courses: FirstCourse[], lessonId: number | null): FirstCourse | null {
  if (!lessonId) return null
  return courses.find((course) => course.lessons.some((lesson) => lesson.id === lessonId)) || null
}

function lessonOf(course: FirstCourse | null, lessonId: number | null): FirstLesson | null {
  if (!course || !lessonId) return null
  return course.lessons.find((lesson) => lesson.id === lessonId) || null
}

/**
 * After a door has pointed at a sitting, keep a long on-topic talk.
 * Walk back only to an earlier long part that is still in this door.
 * Never cross topics, and never offer another course as a fallback.
 */
export function pickGentleFirstCourse(recommendedLessonId: number | null, courses: FirstCourse[], onTopicIds?: number[]): FirstPick | null {
  const topic = onTopicIds ? new Set(onTopicIds) : null
  const inTopic = (id: number) => !topic || topic.has(id)
  const hit = courseOfLesson(courses, recommendedLessonId)
  const hitLesson = lessonOf(hit, recommendedLessonId)

  if (hit && hitLesson && inTopic(hitLesson.id)) {
    if (isLongTalk(hitLesson, hit.courseTitle) && !isLifeStageTopic(`${hit.courseTitle} ${hitLesson.title}`)) {
      const earlier = earliestLongLesson(hit, seriesSiblings(hit, hitLesson).filter((row) => inTopic(row.id)))
      const hitPart = seriesPartNumber(hitLesson.title)
      const earlyPart = earlier ? seriesPartNumber(earlier.title) : null
      if (earlier && earlier.id !== hitLesson.id && hitPart != null && earlyPart != null && earlyPart < hitPart && sameSeries(hitLesson.title, earlier.title) && inTopic(earlier.id)) {
        return pickOf(hit, earlier, `The door pointed at a later sitting. Offering the earliest full talk of this series instead.`)
      }
      return pickOf(hit, hitLesson, `This is the full talk the door opened on.`)
    }
    if (isLifeStageTopic(`${hit.courseTitle} ${hitLesson.title}`)) {
      return pickOf(hit, hitLesson, 'This sitting is for one life stage.')
    }
    return pickOf(hit, hitLesson, 'This sitting is under 10 minutes.')
  }

  if (topic && topic.size) {
    for (const course of courses) {
      const own = course.lessons.filter((lesson) => topic.has(lesson.id))
      const first = earliestLongLesson({ ...course, lessons: own })
      if (!first || isLifeStageTopic(`${course.courseTitle} ${first.title}`)) continue
      return pickOf(course, first, `An on-topic full talk in this door.`)
    }
  }

  return null
}

export type FirstCourseVerdict = { ok: boolean; note: string }

/** Honest dry-run mark: OK only for a long on-topic talk that is part 1 or the earliest sitting. */
export function firstCourseVerdict(pick: FirstPick | null, courses: FirstCourse[], onTopicIds?: number[]): FirstCourseVerdict {
  if (!pick) return { ok: false, note: 'NO ON-TOPIC LONG TALK' }
  if (onTopicIds && !onTopicIds.includes(pick.lessonId)) return { ok: false, note: 'OFF-TOPIC' }
  const course = courses.find((row) => row.courseId === pick.courseId)
  const lesson = course?.lessons.find((row) => row.id === pick.lessonId)
  const title = `${pick.courseTitle} ${pick.lessonTitle}`
  if (isShortClipTitle(title)) return { ok: false, note: 'SHORT CLIP' }
  const seconds = secondsOf(lesson || {})
  if (seconds > 0 && seconds < LONG_OPENING_SECONDS) return { ok: false, note: `UNDER 10 MIN (${Math.max(1, Math.round(seconds / 60))} min)` }
  if (isLifeStageTopic(title)) return { ok: false, note: 'LIFE-STAGE TALK' }
  const part = seriesPartNumber(pick.lessonTitle)
  const siblings = (lesson && course ? seriesSiblings(course, lesson) : course?.lessons || []).filter((row) => !onTopicIds || onTopicIds.includes(row.id))
  const earliest = earliestNumber({ courseId: pick.courseId, courseTitle: pick.courseTitle, lessons: siblings })
  if (part != null && earliest != null && part > earliest) return { ok: false, note: 'LATER PART' }
  if (!lesson) return { ok: false, note: 'MISSING LESSON' }
  return { ok: true, note: 'OK' }
}

/** When the library's earliest numbered sitting is not 1. */
export function libraryStartNote(titles: string[]): string | null {
  const numbers = titles.map((title) => seriesPartNumber(title)).filter((value): value is number => value != null)
  if (!numbers.length) return null
  const earliest = Math.min(...numbers)
  if (earliest <= 1) return null
  return `Our library starts this course at Lesson ${earliest}.`
}
