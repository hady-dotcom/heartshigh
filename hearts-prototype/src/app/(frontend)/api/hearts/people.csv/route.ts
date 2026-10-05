import { getSession } from '@/server/context'
import { json, portalOf, viewAsRefusal } from '@/server/api'
import { audit } from '@/server/audit'
import { portalIdOf } from '@/lib/ids'
import { buildPeopleExport } from '@/server/people'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session.actor) return json({ error: 'Sign in first.' }, 401)
  if (session.actor.role === 'learner') return json({ error: 'The people list is for the portal team.' }, 403)
  const refused = await viewAsRefusal(session, 'people.export')
  if (refused) return refused
  const url = new URL(req.url)
  const portal = await portalOf(session, req)
  const portalId = portal?.id || (session.actor.role === 'master' ? null : portalIdOf(session.actor))
  if (session.actor.role !== 'master' && !portalId) return json({ error: 'That portal is not yours.' }, 403)
  if (session.actor.role !== 'master' && url.searchParams.get('portal') && portal && portalIdOf(session.actor) !== portal.id) {
    return json({ error: 'That portal is not yours.' }, 403)
  }
  const built = await buildPeopleExport(session.payload, session.actor.role === 'master' ? portal?.id || portalId : portalId)
  if (built.blocked) return json({ error: built.blocked }, 400)
  await audit(session.payload, 'people.export', {
    actor: session.actor,
    actorRole: session.actor.role,
    portal: portalId,
    detail: { count: built.rows.length },
  })
  const slug = portal?.slug || 'hearts'
  return new Response(built.csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="people-${slug}.csv"`,
      'cache-control': 'no-store',
    },
  })
}
