import { createHmac } from 'node:crypto'
import { portalIdOf } from '@/lib/ids'
import { now } from '@/lib/clock'
import { isoWeek } from '@/lib/trends'
import { getSession } from '@/server/context'
import { json, readBody, viewAsRefusal } from '@/server/api'

export const dynamic = 'force-dynamic'

const list = (value: unknown, max: number) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && /^[a-z-]{2,30}$/.test(item)).slice(0, max) : [])

/**
 * One contribution per account per week. The key is a keyed hash of the account and the week, made here: the
 * client does not choose it, and without the server secret it cannot be turned back into an account.
 */
function weeklyKey(userId: number, week: string) {
  return createHmac('sha256', `${process.env.PAYLOAD_SECRET || 'hearts-prototype-dev-secret'}:trends`).update(`${userId}:${week}`).digest('hex').slice(0, 32)
}

/** P6: signed in and opted in only. No user id is stored with the row. */
export async function POST(req: Request) {
  const session = await getSession()
  if (!session.actor) return json({ error: 'Sign in first.' }, 401)
  const refused = await viewAsRefusal(session, 'contribute', true)
  if (refused) return refused
  if (!session.actor.trendsOptIn) return json({ error: 'Trends are off for this account.' }, 403)
  const portal = portalIdOf(session.actor)
  if (!portal) return json({ error: 'Your account is not in a portal.' }, 403)
  const body = await readBody(req)
  const week = isoWeek(now())
  const nonceHash = weeklyKey(session.actor.id, week)
  const data = { portal, isoWeek: week, doorKey: typeof body.doorKey === 'string' && /^[a-z-]{2,30}$/.test(body.doorKey) ? body.doorKey : undefined, scenePasses: list(body.scenePasses, 6), laneTop2: list(body.laneTop2, 2), nonceHash }
  const existing = await session.payload.find({ collection: 'heart-contributions', overrideAccess: true, depth: 0, limit: 1, where: { nonceHash: { equals: nonceHash } } })
  if (existing.docs.length) {
    await session.payload.update({ collection: 'heart-contributions', id: existing.docs[0].id, overrideAccess: true, data: data as never })
    return json({ ok: true, duplicate: true })
  }
  await session.payload.create({ collection: 'heart-contributions', overrideAccess: true, data: data as never })
  return json({ ok: true }, 201)
}
