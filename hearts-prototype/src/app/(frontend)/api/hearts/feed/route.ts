import { getSession } from '@/server/context'
import { json, portalOf, readBody } from '@/server/api'
import { serveFeed } from '@/server/opening'

export const dynamic = 'force-dynamic'

const number = (value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback)

/**
 * Signed in only: before sign-up the device routes its own feed from GET /api/hearts/opening, so nothing derived
 * from taps leaves it. P2: the body carries lane scores, the lead lane, the spine-first choice, served clip ids and the spine pointer.
 * No taps and no scales. The body is not logged.
 */
export async function POST(req: Request) {
  const session = await getSession({ touch: false })
  if (!session.user) return json({ error: 'Sign in first. Before that, the feed is routed on your device.' }, 401)
  const portal = await portalOf(session, req)
  if (!portal) return json({ error: 'That portal could not be found.' }, 404)
  const body = await readBody(req)
  const laneScores = Object.fromEntries(
    Object.entries((body.laneScores as Record<string, unknown>) || {})
      .filter(([key, value]) => /^[a-z-]{2,30}$/.test(key) && typeof value === 'number' && Number.isFinite(value))
      .slice(0, 20),
  ) as Record<string, number>
  const plan = {
    laneScores,
    lead: typeof body.lead === 'string' ? body.lead : undefined,
    spineFirst: body.spineFirst === true,
    served: Array.isArray(body.served) ? (body.served as unknown[]).map(String).slice(-50) : [],
    spinePointer: Math.max(0, Math.min(41, number(body.spinePointer))),
    firstOpenAt: typeof body.firstOpenAt === 'number' ? body.firstOpenAt : undefined,
  }
  const { items, slots, spinePointer } = await serveFeed(session.payload, portal, session.user, plan)
  return json({ items: slots.map((slot) => ({ cutId: slot.cutId, laneKey: slot.laneKey, clause: slot.clause, kind: slot.kind })), clips: items, spinePointer })
}
