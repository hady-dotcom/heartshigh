import type { Payload, Where } from 'payload'
import { sharedAnswerWhere, teachSeenAt, withTeachSeen } from '@/lib/shared-answers'
import type { SessionUser } from './context'

/** Wall clock, matching the database timestamp on an answer. A frozen test clock must not hide a new answer. */
export function visitStamp() {
  return new Date().toISOString()
}

export async function markTeachVisit(payload: Payload, user: SessionUser, portalId: number) {
  const at = visitStamp()
  const teachSeen = withTeachSeen(user.teachSeen, portalId, at)
  await payload.update({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
    data: { teachSeen } as never,
  })
  user.teachSeen = teachSeen
  return at
}

export async function countNewSharedAnswers(payload: Payload, portalId: number, seenAt: string | null) {
  const found = await payload.count({
    collection: 'answers',
    overrideAccess: true,
    where: sharedAnswerWhere(portalId, seenAt) as Where,
  })
  return found.totalDocs
}

/** Newest shared answers since the last Teach visit, for the badge and the placement list. */
export async function newSharedAnswers(payload: Payload, portalId: number, seenAt: string | null, limit = 8) {
  const found = await payload.find({
    collection: 'answers',
    overrideAccess: true,
    depth: 1,
    limit,
    sort: '-createdAt',
    where: sharedAnswerWhere(portalId, seenAt) as Where,
  })
  return { total: found.totalDocs, docs: found.docs }
}

export function seenFor(user: SessionUser, portalId: number) {
  return teachSeenAt(user.teachSeen, portalId)
}
