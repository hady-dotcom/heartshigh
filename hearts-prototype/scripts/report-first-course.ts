/**
 * Read-only report of the first course each of the 20 doors would offer.
 * Prints the current recommendLesson hit and the gentle part-1 pick.
 * Never writes.
 *
 *   npm run report:first-course
 */
import { closePayload, clearDevPushMarker } from '../src/lib/prepare-db'
import { DOORS } from '../src/lib/doors'
import { recommendLesson } from '../src/lib/placing'
import { isGentleOpening, pickGentleFirstCourse, seriesPartNumber } from '../src/lib/first-course'
import { idOf } from '../src/lib/ids'

await clearDevPushMarker()
const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })

try {
  const courses = ((await payload.find({ collection: 'courses', overrideAccess: true, depth: 0, limit: 0, pagination: false })).docs as { id: number; title?: string }[])
  const lessons = ((await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: 0, pagination: false })).docs as { id: number; title?: string; order?: number; course?: unknown }[])
  const cuts = ((await payload.find({ collection: 'cuts', overrideAccess: true, depth: 0, limit: 0, pagination: false })).docs as { lesson?: unknown; bestClause?: number; status?: string }[])
  const lessonOrder = courses.flatMap((course) => lessons.filter((lesson) => idOf(lesson.course) === course.id).map((lesson) => lesson.id))
  const cutRows = cuts.map((cut) => ({ lessonId: idOf(cut.lesson) || 0, bestClause: cut.bestClause || null, approved: cut.status === 'approved' }))
  const catalogue = courses.map((course) => ({
    courseId: course.id,
    courseTitle: String(course.title || ''),
    lessons: lessons
      .filter((lesson) => idOf(lesson.course) === course.id)
      .map((lesson) => ({ id: lesson.id, title: String(lesson.title || ''), order: Number(lesson.order || 0) })),
  }))

  console.log('First-course report (read-only). Nothing is written.\n')
  let bad = 0
  for (const door of DOORS) {
    const clause = Math.min(...door.clauses)
    const hitId = recommendLesson(clause, cutRows, lessonOrder)
    const hit = lessons.find((lesson) => lesson.id === hitId)
    const pick = pickGentleFirstCourse(hitId, catalogue)
    const hitTitle = hit ? String(hit.title || '') : '(none)'
    const pickTitle = pick ? `${pick.courseTitle} · ${pick.lessonTitle}` : '(none)'
    const part = pick ? seriesPartNumber(pick.lessonTitle) : null
    const ok = Boolean(pick && (part == null || part === 1) && isGentleOpening(pick.lessonTitle))
    if (!ok) bad += 1
    console.log(`Door ${door.number} ${door.title}`)
    console.log(`  clause ${clause}  current hit: ${hitId || '—'} ${hitTitle}`)
    console.log(`  would offer: ${pickTitle}`)
    console.log(`  ${pick?.reason || ''}  ${ok ? 'OK' : 'NEEDS A GENTLER PART 1'}`)
  }
  console.log(`\n${DOORS.length} doors. ${bad} still open on a later part or a life-stage talk. No rows were changed.`)
} finally {
  await closePayload(payload)
}
