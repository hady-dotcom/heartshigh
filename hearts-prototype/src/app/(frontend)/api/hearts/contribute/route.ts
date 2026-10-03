import { portalIdOf } from '@/lib/ids'
import { getSession } from '@/server/context'
import { json, readBody, viewAsRefusal } from '@/server/api'

export const dynamic = 'force-dynamic'

const list = (value: unknown, max: number) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && /^[a-z-]{2,30}$/.test(item)).slice(0, max) : [])

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
  const isoWeek = String(body.isoWeek || '')
  const nonceHash = String(body.nonceHash || '')
  if (!/^\d{4}-W\d{2}$/.test(isoWeek) || !/^[a-f0-9]{16,64}$/.test(nonceHash)) return json({ error: 'That contribution could not be read.' }, 400)
  const dupe = await session.payload.find({ collection: 'heart-contributions', overrideAccess: true, depth: 0, limit: 1, where: { and: [{ isoWeek: { equals: isoWeek } }, { nonceHash: { equals: nonceHash } }] } })
  if (dupe.docs.length) return json({ ok: true, duplicate: true })
  await session.payload.create({
    collection: 'heart-contributions',
    overrideAccess: true,
    data: { portal, isoWeek, doorKey: typeof body.doorKey === 'string' ? body.doorKey.slice(0, 30) : undefined, scenePasses: list(body.scenePasses, 6), laneTop2: list(body.laneTop2, 2), nonceHash } as never,
  })
  return json({ ok: true }, 201)
}
