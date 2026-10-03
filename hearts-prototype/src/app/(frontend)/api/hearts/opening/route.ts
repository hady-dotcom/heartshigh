import { getSession } from '@/server/context'
import { json, portalOf } from '@/server/api'
import { loadOpening } from '@/server/opening'

export const dynamic = 'force-dynamic'

/** Published scenes with this portal's wording, help contacts and the default clip. Nothing personal. */
export async function GET(req: Request) {
  const session = await getSession({ touch: false })
  const portal = await portalOf(session, req)
  if (!portal) return json({ error: 'That portal could not be found.' }, 404)
  const opening = await loadOpening(session.payload, portal, session.user)
  return json(opening)
}
