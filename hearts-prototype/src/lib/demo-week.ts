import { isProduction, isRemoteDatabase, type Env } from './env'
import { areaOfDoor, GARDEN_AREAS } from './garden-areas'
import { dateKeyInZone, mondayKey, LEARNER_ZONE } from './week'

export const AFTERNOON_PLAN = 'Afternoon walk week'
export const DEMO_WALK_EMAIL = 'elm-learner@hearts.test'
export const DEMO_WALK_PORTAL = 'east-london'

export type AreaLessonPick = { id: number; courseId: number; title: string; door: number | null }

/** One or two talks per garden tree, so each area can show fruit. */
export function pickLessonsByArea(lessons: AreaLessonPick[], perArea = 2) {
  const picked: AreaLessonPick[] = []
  const seen = new Set<number>()
  for (const area of GARDEN_AREAS) {
    const own = lessons.filter((lesson) => areaOfDoor(lesson.door)?.id === area.id && !seen.has(lesson.id))
    for (const lesson of own.slice(0, perArea)) {
      seen.add(lesson.id)
      picked.push(lesson)
    }
  }
  if (picked.length >= 5) return picked
  for (const lesson of lessons) {
    if (seen.has(lesson.id)) continue
    seen.add(lesson.id)
    picked.push(lesson)
    if (picked.length >= 8) break
  }
  return picked
}

export type DemoWeekSlot = { date: string; title: string; lessonId: number; courseId: number }

/** Spread talks across the current Monday–Sunday so My week looks full. */
export function demoWeekSlots(input: { lessons: { id: number; title: string; courseId: number }[]; monday: string }): DemoWeekSlot[] {
  const dates = Array.from({ length: 7 }, (_, index) => {
    const at = new Date(`${input.monday}T12:00:00Z`)
    at.setUTCDate(at.getUTCDate() + index)
    return at.toISOString().slice(0, 10)
  })
  const talks = input.lessons.filter((lesson) => lesson.id && lesson.courseId)
  if (!talks.length) return []
  return talks.map((lesson, index) => ({
    date: dates[index % dates.length],
    title: lesson.title,
    lessonId: lesson.id,
    courseId: lesson.courseId,
  }))
}

export function demoWeekMonday(now = new Date(), timeZone = LEARNER_ZONE) {
  return mondayKey(now, timeZone)
}

export function demoWeekToday(now = new Date(), timeZone = LEARNER_ZONE) {
  return dateKeyInZone(now, timeZone)
}

/** Past days, newest first, so Garden Days you came shows flowers this week. */
export function demoGardenAt(now: Date, index: number) {
  const at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (index % 7), 18, 0, 0))
  return at.toISOString()
}

export function demoWeekGardenGuard(env: Env = process.env) {
  if (isProduction(env) || isRemoteDatabase(env)) {
    return 'Refusing to write the afternoon walk on a production or remote database. Nothing was changed.'
  }
  return null
}
