import type { Payload } from 'payload'
import { idOf } from '@/lib/ids'
import { talkPartOpen } from '@/lib/talk-part'
import type { SessionUser } from '@/server/context'

/** One read, then a second if the first threw. A lock blip must not look like a missing course. */
async function readRow(payload: Payload, collection: 'courses' | 'lessons', id: number) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await payload.findByID({ collection, id, overrideAccess: true, depth: 0 })
    } catch {
      if (attempt === 1) return null
    }
  }
  return null
}

/** True when this learner can open this part. False is "No full talk", not a 404. */
export async function learnerCanOpenTalk(payload: Payload, user: SessionUser, courseId: number, lessonId: number) {
  if (!user.id || !Number.isFinite(courseId) || courseId <= 0 || !Number.isFinite(lessonId) || lessonId <= 0) return false
  const [course, lesson] = await Promise.all([readRow(payload, 'courses', courseId), readRow(payload, 'lessons', lessonId)])
  const row = lesson as { id: number; course?: unknown; publishState?: string | null; transcriptNote?: string | null } | null
  return talkPartOpen({
    courseId,
    lessonId,
    courseExists: Boolean(course),
    lesson: row
      ? {
          id: row.id,
          courseId: idOf(row.course) || 0,
          publishState: row.publishState ?? null,
          transcriptNote: row.transcriptNote ?? null,
        }
      : null,
  })
}
