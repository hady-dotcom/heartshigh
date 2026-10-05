/**
 * Read-only report of the first course each of the 20 doors would offer.
 * OK only when the pick is a long talk with a genuine topical match.
 * Never writes.
 *
 *   npm run report:first-course
 */
import { closePayload, clearDevPushMarker } from '../src/lib/prepare-db'
import { DOORS } from '../src/lib/doors'
import { recommendLesson } from '../src/lib/placing'
import { firstCourseVerdict, matchDoorTalk, pickGentleFirstCourse } from '../src/lib/first-course'
import { doorNumberOfClause } from '../src/lib/doors'
import { idOf } from '../src/lib/ids'
import { tidyTalkTitle } from '../src/lib/talk-title'

const TEST_COURSE = /ten sittings|teacher sittings/i
const TEST_VIDEO = /^(dQw4w9WgXcQ|xxTESTFAKEid)$/

await clearDevPushMarker()
const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })

try {
  const courses = ((await payload.find({ collection: 'courses', overrideAccess: true, depth: 0, limit: 0, pagination: false })).docs as { id: number; title?: string }[])
    .filter((course) => !TEST_COURSE.test(String(course.title || '')))
  const lessons = ((await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: 0, pagination: false })).docs as { id: number; title?: string; order?: number; course?: unknown; durationSeconds?: number; youtubeId?: string }[])
    .filter((lesson) => !TEST_VIDEO.test(String(lesson.youtubeId || '')) && !TEST_COURSE.test(String(courses.find((course) => course.id === idOf(lesson.course))?.title || '')))
  const cuts = ((await payload.find({ collection: 'cuts', overrideAccess: true, depth: 0, limit: 0, pagination: false })).docs as { lesson?: unknown; bestClause?: number; status?: string; hook?: string; turn?: string; land?: string; fullContext?: string }[])
  const lessonOrder = courses.flatMap((course) => lessons.filter((lesson) => idOf(lesson.course) === course.id).map((lesson) => lesson.id))
  const cutRows = cuts.map((cut) => ({ lessonId: idOf(cut.lesson) || 0, bestClause: cut.bestClause || null, approved: cut.status === 'approved' }))
  const catalogue = courses.map((course) => ({
    courseId: course.id,
    courseTitle: String(course.title || ''),
    lessons: lessons
      .filter((lesson) => idOf(lesson.course) === course.id)
      .map((lesson) => ({ id: lesson.id, title: String(lesson.title || ''), order: Number(lesson.order || 0), durationSeconds: Number(lesson.durationSeconds || 0) })),
  }))
  const quotesOf = (lessonId: number) => cuts.filter((cut) => idOf(cut.lesson) === lessonId).flatMap((cut) => [cut.hook, cut.turn, cut.land, cut.fullContext].map((value) => String(value || '')).filter(Boolean))

  console.log('First-course report (read-only). Nothing is written.\n')
  const empty: string[] = []
  let bad = 0
  for (const door of DOORS) {
    const clause = Math.min(...door.clauses)
    const tagged = [...new Set(cutRows.filter((cut) => doorNumberOfClause(cut.bestClause) === door.number && lessonOrder.includes(cut.lessonId)).map((cut) => cut.lessonId))]
    const onTopicIds = tagged.filter((lessonId) => {
      const lesson = lessons.find((row) => row.id === lessonId)
      const course = courses.find((row) => row.id === idOf(lesson?.course))
      return Boolean(lesson && matchDoorTalk(door.number, { title: String(lesson.title || ''), courseTitle: String(course?.title || ''), quotes: quotesOf(lessonId) }))
    })
    const hitId = recommendLesson(clause, cutRows, lessonOrder)
    const hit = lessons.find((lesson) => lesson.id === hitId)
    const pick = pickGentleFirstCourse(onTopicIds.includes(hitId || 0) ? hitId : onTopicIds[0] || null, catalogue, onTopicIds)
    const match = pick ? matchDoorTalk(door.number, { title: pick.lessonTitle, courseTitle: pick.courseTitle, quotes: quotesOf(pick.lessonId) }) : null
    const verdict = firstCourseVerdict(pick, catalogue, onTopicIds)
    if (!verdict.ok) bad += 1
    if (!pick) empty.push(`Door ${door.number} ${door.title}`)
    const seconds = pick ? catalogue.find((course) => course.courseId === pick.courseId)?.lessons.find((lesson) => lesson.id === pick.lessonId)?.durationSeconds || 0 : 0
    const pickTitle = pick ? `${tidyTalkTitle(pick.courseTitle)} · ${tidyTalkTitle(pick.lessonTitle)}` : '(none)'
    console.log(`Door ${door.number} ${door.title}`)
    console.log(`  clause ${clause}  current hit: ${hitId || '—'} ${hit ? tidyTalkTitle(String(hit.title || '')) : '(none)'}`)
    console.log(`  would offer: ${pickTitle}${seconds ? ` (${Math.round(seconds / 60)} min)` : ''}`)
    console.log(`  matched text: ${match?.text || (pick ? '—' : 'none — a longer talk for this door is on its way')}`)
    console.log(`  ${pick?.reason || 'This door has no on-topic long talk in the library.'}  ${verdict.note}`)
  }
  console.log(`\nEmpty doors (${empty.length}): ${empty.length ? empty.join('; ') : 'none'}`)
  console.log(`\n${DOORS.length} doors. ${bad} still open on a short clip, a later part, a life-stage talk, an off-topic fallback, or have no on-topic long talk. No rows were changed.`)
} finally {
  await closePayload(payload)
}
