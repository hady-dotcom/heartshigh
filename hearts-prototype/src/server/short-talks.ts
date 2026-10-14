import type { Payload } from 'payload'
import { idOf } from '@/lib/ids'
import { formatTimestamp } from '@/lib/transcript'
import { EMPTY_SHORT_COURSE_NOTE, isUnderMinTalk } from '@/lib/talk-length'

type Doc = Record<string, unknown> & { id: number }

async function allDocs(payload: Payload, collection: string, where?: Record<string, unknown>) {
  const found = await payload.find({
    collection: collection as 'lessons',
    overrideAccess: true,
    depth: 0,
    limit: 0,
    pagination: false,
    ...(where ? { where: where as never } : {}),
  })
  return found.docs as unknown as Doc[]
}

function courseIdOf(lesson: Doc) {
  return idOf(lesson.course) || 0
}

/**
 * Hide every talk under five minutes, and the clips cut from it.
 * A talk a person has restored is left alone. Safe to run again.
 */
export async function markShortTalks(payload: Payload) {
  const lessons = await allDocs(payload, 'lessons')
  let marked = 0
  let already = 0
  let cleared = 0
  for (const lesson of lessons) {
    const seconds = Number(lesson.durationSeconds || 0)
    const waived = lesson.shortWaived === true
    const short = isUnderMinTalk(seconds) && !waived
    if (short && lesson.tooShort === true) {
      already += 1
      continue
    }
    if (short) {
      await payload.update({ collection: 'lessons', id: lesson.id, overrideAccess: true, data: { tooShort: true } as never })
      lesson.tooShort = true
      marked += 1
      continue
    }
    if (lesson.tooShort === true && !short) {
      await payload.update({ collection: 'lessons', id: lesson.id, overrideAccess: true, data: { tooShort: false } as never })
      lesson.tooShort = false
      cleared += 1
    }
  }
  const hiddenIds = new Set(lessons.filter((lesson) => lesson.tooShort === true).map((lesson) => lesson.id))
  let clips = 0
  for (const collection of ['cuts', 'ladder-items'] as const) {
    const rows = await allDocs(payload, collection)
    for (const row of rows) {
      const lessonId = idOf(row.lesson) || 0
      const want = hiddenIds.has(lessonId)
      if (want === (row.tooShort === true)) continue
      await payload.update({ collection, id: row.id, overrideAccess: true, data: { tooShort: want } as never })
      clips += 1
    }
  }
  const coursesHidden = await refreshEmptyCourses(payload, lessons)
  return { marked, already, cleared, clips, coursesHidden }
}

async function refreshEmptyCourses(payload: Payload, lessons: Doc[]) {
  const courses = await allDocs(payload, 'courses')
  const byCourse = new Map<number, Doc[]>()
  for (const lesson of lessons) {
    const courseId = courseIdOf(lesson)
    if (!courseId) continue
    const list = byCourse.get(courseId) || []
    list.push(lesson)
    byCourse.set(courseId, list)
  }
  let hidden = 0
  for (const course of courses) {
    const own = byCourse.get(course.id) || []
    const empty = own.length > 0 && own.every((lesson) => lesson.tooShort === true)
    const note = String(course.hiddenNote || '')
    if (empty && course.hidden !== true) {
      await payload.update({
        collection: 'courses',
        id: course.id,
        overrideAccess: true,
        data: { hidden: true, hiddenNote: EMPTY_SHORT_COURSE_NOTE } as never,
      })
      hidden += 1
    } else if (!empty && course.hidden === true && note === EMPTY_SHORT_COURSE_NOTE) {
      await payload.update({
        collection: 'courses',
        id: course.id,
        overrideAccess: true,
        data: { hidden: false, hiddenNote: null } as never,
      })
    }
  }
  return hidden
}

export async function restoreShortTalk(payload: Payload, lessonId: number) {
  const lesson = (await payload.findByID({ collection: 'lessons', id: lessonId, depth: 0, overrideAccess: true }).catch(() => null)) as Doc | null
  if (!lesson) return { error: 'That talk could not be found.' }
  await payload.update({
    collection: 'lessons',
    id: lesson.id,
    overrideAccess: true,
    data: { tooShort: false, shortWaived: true } as never,
  })
  lesson.tooShort = false
  lesson.shortWaived = true
  for (const collection of ['cuts', 'ladder-items'] as const) {
    const rows = await allDocs(payload, collection, { lesson: { equals: lesson.id } })
    for (const row of rows) {
      if (row.tooShort !== true) continue
      await payload.update({ collection, id: row.id, overrideAccess: true, data: { tooShort: false } as never })
    }
  }
  const courseId = courseIdOf(lesson)
  if (courseId) {
    const siblings = await allDocs(payload, 'lessons', { course: { equals: courseId } })
    const current = siblings.map((row) => (row.id === lesson.id ? lesson : row))
    await refreshEmptyCourses(payload, current)
  }
  return { notice: `${String(lesson.title || 'That talk')} is restored. Learners can see it again.` }
}

export type ShortTalkRow = {
  id: number
  title: string
  speaker: string
  durationSeconds: number
  courseId: number
  courseTitle: string
  courseHidden: boolean
  courseNote: string
  length: string
}

export async function listShortTalks(payload: Payload): Promise<ShortTalkRow[]> {
  const [lessons, courses] = await Promise.all([
    allDocs(payload, 'lessons', { tooShort: { equals: true } }),
    allDocs(payload, 'courses'),
  ])
  const courseById = new Map(courses.map((course) => [course.id, course]))
  return lessons
    .map((lesson) => {
      const course = courseById.get(courseIdOf(lesson))
      const speaker = String(lesson.speaker || course?.speaker || '').trim()
      const durationSeconds = Math.round(Number(lesson.durationSeconds || 0))
      return {
        id: lesson.id,
        title: String(lesson.title || 'Untitled'),
        speaker,
        durationSeconds,
        courseId: courseIdOf(lesson),
        courseTitle: String(course?.title || ''),
        courseHidden: course?.hidden === true,
        courseNote: String(course?.hiddenNote || ''),
        length: durationSeconds > 0 ? formatTimestamp(durationSeconds) : '',
      }
    })
    .sort((a, b) => a.durationSeconds - b.durationSeconds || a.title.localeCompare(b.title))
}
