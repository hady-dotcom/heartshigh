import type { Payload, Where } from 'payload'
import type { Door } from '@/lib/doors'
import {
  groupCourses,
  type CourseInput,
  type CutPlacement,
  type DoorGroup,
  type LessonInput,
  type SeatInfo,
} from '@/lib/curriculum-groups'
import { loadDoors } from './doors'

type Doc = Record<string, unknown> & { id: number }

export async function listDocs(payload: Payload, collection: string, where?: Where) {
  const docs: Doc[] = []
  let page = 1
  for (;;) {
    const found = await payload.find({
      collection: collection as 'courses',
      overrideAccess: true,
      depth: 0,
      limit: 200,
      page,
      where,
    })
    docs.push(...(found.docs as unknown as Doc[]))
    if (!found.hasNextPage || page > 40) break
    page += 1
  }
  return docs
}

function num(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value && !Number.isNaN(Number(value))) return Number(value)
  if (value && typeof value === 'object' && 'id' in value) return num((value as { id?: unknown }).id)
  return null
}

/** Door groups for these courses, from the clause and seat already stored on each talk's cuts. */
export async function groupThese(payload: Payload, courses: CourseInput[], doors?: Door[]): Promise<DoorGroup[]> {
  if (!courses.length) return []
  const ids = courses.map((course) => course.id)
  const [lessonDocs, seatDocs, clauseDocs, resolvedDoors] = await Promise.all([
    listDocs(payload, 'lessons', { course: { in: ids } }),
    listDocs(payload, 'seats'),
    listDocs(payload, 'clauses'),
    doors ? Promise.resolve(doors) : loadDoors(payload),
  ])
  const lessons: LessonInput[] = lessonDocs.map((lesson) => ({ id: lesson.id, courseId: num(lesson.course) || 0 })).filter((lesson) => lesson.courseId)
  const lessonIds = lessons.map((lesson) => lesson.id)
  const cutDocs = lessonIds.length ? await listDocs(payload, 'cuts', { lesson: { in: lessonIds } }) : []
  const clauseNumber = new Map(clauseDocs.map((clause) => [clause.id, Number(clause.number || 0)]))
  const seats: SeatInfo[] = seatDocs
    .map((seat) => ({
      id: seat.id,
      clause: clauseNumber.get(num(seat.clause) || 0) || 0,
      position: Number(seat.position || 0),
      text: String(seat.text || ''),
    }))
    .filter((seat) => seat.clause && seat.position)
  const cuts: CutPlacement[] = cutDocs.map((cut) => ({
    lessonId: num(cut.lesson) || 0,
    clause: cut.bestClause == null || cut.bestClause === '' ? null : Number(cut.bestClause) || null,
    seatId: num(cut.seat),
  }))
  return groupCourses(courses, lessons, cuts, seats, resolvedDoors)
}
