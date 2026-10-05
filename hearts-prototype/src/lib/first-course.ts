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
  seconds?: number
  matchText?: string
}

export type DoorTalk = { title: string; courseTitle?: string; quotes?: string[] }
export type DoorTopicHit = { text: string; where: 'title' | 'course' | 'quote' }

/**
 * A door only claims a talk when the title (or a quote, if the title is not already
 * a Names class about another subject) names that door's topic.
 */
const DOOR_NEED: Record<number, RegExp[]> = {
  1: [/\b(one day|this day|the day you are given)\b/i],
  2: [/\b(sat with|the sitting|how he came and sat)\b/i],
  3: [/\b(about islam|tell me about islam|islam named)\b/i],
  4: [/\b(two testimonies|shahada|l[aā] il[aā]ha)\b/i],
  5: [/\b(establish(?:ing)? the prayer|the prayer|salah|salat|fajr|qibla)\b/i],
  6: [/\b(zakat|wealth has people)\b/i],
  7: [/\b(fasting ramadan|sawm|fast ramadan)\b/i],
  8: [/\bhajj\b/i],
  9: [/\b(about iman|the six|islam is not iman)\b/i],
  10: [/\b(believe in allah|who allah is|ar-?rabb|\brabb\b|al-?n[uū]r|source of (?:all )?light|names of allah)\b/i],
  11: [/\b(his angels|malaikah|jibril is already)\b/i],
  12: [/\b(his books|kitab allah|the qur'?an as (?:his )?speech)\b/i],
  13: [/\b(his messengers|the messengers)\b/i],
  14: [/\b(last day|day of judgment|akhira|resurrection|the tomb|garden and (?:the )?fire)\b/i],
  15: [/\b(qadar|decree|good and evil)\b/i],
  16: [/\b(ihsan|as though you see|he sees you)\b/i],
  17: [/\b(the hour|when is the hour|cannot be known)\b/i],
  18: [/\b(slave-?girl|shepherds compete|two signs)\b/i],
  19: [/\b(it was jibril|that was jibril)\b/i],
  20: [/\b(teach you your religion|your religion)\b/i],
}

function snippetAround(hay: string, hit: string) {
  const at = hay.toLowerCase().indexOf(hit.toLowerCase())
  if (at < 0) return hit
  const start = Math.max(0, at - 40)
  const end = Math.min(hay.length, at + hit.length + 60)
  return `${start > 0 ? '…' : ''}${hay.slice(start, end).replace(/\s+/g, ' ').trim()}${end < hay.length ? '…' : ''}`
}

export function matchDoorTalk(doorNumber: number, talk: DoorTalk): DoorTopicHit | null {
  const need = DOOR_NEED[doorNumber]
  if (!need?.length) return null
  const course = (talk.courseTitle || '').trim()
  const title = (talk.title || '').trim()
  const tryText = (value: string, where: DoorTopicHit['where']): DoorTopicHit | null => {
    for (const pattern of need) {
      const found = value.match(pattern)
      if (found?.[0]) return { text: snippetAround(value, found[0]), where }
    }
    return null
  }
  const titleHit = tryText(title, 'title') || (course ? tryText(course, 'course') : null)
  if (titleHit) return titleHit
  if (/the names class\s*\d+/i.test(`${course} ${title}`) && doorNumber !== 10) return null
  for (const quote of talk.quotes || []) {
    const hit = tryText(String(quote || ''), 'quote')
    if (hit) return hit
  }
  return null
}

function earliestNumber(course: FirstCourse): number | null {
  const numbers = course.lessons.map((lesson) => seriesPartNumber(lesson.title)).filter((value): value is number => value != null)
  return numbers.length ? Math.min(...numbers) : null
}

function pickOf(course: FirstCourse, lesson: FirstLesson, reason: string, extra: { matchText?: string } = {}): FirstPick {
  return {
    courseId: course.courseId,
    lessonId: lesson.id,
    courseTitle: course.courseTitle,
    lessonTitle: lesson.title,
    reason,
    seconds: secondsOf(lesson),
    matchText: extra.matchText,
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
