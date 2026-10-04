/**
 * Read-only report of the first course each of the 20 doors would offer.
 * OK only when the pick is a long talk and is part 1 or the earliest sitting in the library.
 * Never writes.
 *
 *   npm run report:first-course
 */
import { closePayload, clearDevPushMarker } from '../src/lib/prepare-db'
import { DOORS } from '../src/lib/doors'
import { recommendLesson } from '../src/lib/placing'
import { firstCourseVerdict, pickGentleFirstCourse } from '../src/lib/first-course'
import { doorNumberOfClause } from '../src/lib/doors'
import { idOf } from '../src/lib/ids'

await clearDevPushMarker()
const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })

try {
  const courses = ((await payload.find({ collection: 'courses', overrideAccess: true, depth: 0, limit: 0, pagination: false })).docs as { id: number; title?: string }[])
  const lessons = ((await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: 0, pagination: false })).docs as { id: number; title?: string; order?: number; course?: unknown; durationSeconds?: number }[])
  const cuts = ((await payload.find({ collection: 'cuts', overrideAccess: true, depth: 0, limit: 0, pagination: false })).docs as { lesson?: unknown; bestClause?: number; status?: string }[])
  const lessonOrder = courses.flatMap((course) => lessons.filter((lesson) => idOf(lesson.course) === course.id).map((lesson) => lesson.id))
  const cutRows = cuts.map((cut) => ({ lessonId: idOf(cut.lesson) || 0, bestClause: cut.bestClause || null, approved: cut.status === 'approved' }))
  const catalogue = courses.map((course) => ({
    courseId: course.id,
    courseTitle: String(course.title || ''),
    lessons: lessons
      .filter((lesson) => idOf(lesson.course) === course.id)
      .map((lesson) => ({ id: lesson.id, title: String(lesson.title || ''), order: Number(lesson.order || 0), durationSeconds: Number(lesson.durationSeconds || 0) })),
  }))

  console.log('First-course report (read-only). Nothing is written.\n')
  let bad = 0
  for (const door of DOORS) {
    const clause = Math.min(...door.clauses)
    const hitId = recommendLesson(clause, cutRows, lessonOrder)
    const onTopicIds = [...new Set(cutRows.filter((cut) => doorNumberOfClause(cut.bestClause) === door.number && lessonOrder.includes(cut.lessonId)).map((cut) => cut.lessonId))]
    const hit = lessons.find((lesson) => lesson.id === hitId)
    const pick = pickGentleFirstCourse(hitId, catalogue, onTopicIds)
    const hitTitle = hit ? String(hit.title || '') : '(none)'
    const pickTitle = pick ? `${pick.courseTitle} · ${pick.lessonTitle}` : '(none)'
    const verdict = firstCourseVerdict(pick, catalogue, onTopicIds)
    if (!verdict.ok) bad += 1
    const seconds = pick ? catalogue.find((course) => course.courseId === pick.courseId)?.lessons.find((lesson) => lesson.id === pick.lessonId)?.durationSeconds || 0 : 0
    const fallback = hitId && pick && !onTopicIds.includes(pick.lessonId) ? 'OFF-TOPIC' : !hitId && !pick ? 'NO ON-TOPIC LONG TALK' : ''
    console.log(`Door ${door.number} ${door.title}`)
    console.log(`  clause ${clause}  current hit: ${hitId || '—'} ${hitTitle}`)
    console.log(`  would offer: ${pickTitle}${seconds ? ` (${Math.round(seconds / 60)} min)` : ''}`)
    console.log(`  ${pick?.reason || (fallback === 'NO ON-TOPIC LONG TALK' ? 'This door has no on-topic long talk in the library.' : '')}  ${verdict.note}${fallback && fallback !== verdict.note ? `  ${fallback}` : ''}`)
  }
  console.log(`\n${DOORS.length} doors. ${bad} still open on a short clip, a later part, a life-stage talk, an off-topic fallback, or have no on-topic long talk. No rows were changed.`)
} finally {
  await closePayload(payload)
}
