import { getSession, type SessionUser } from '@/server/context'
import { json, portalOf } from '@/server/api'
import { mayReadWorkbook, workbookCsv, workbookFor } from '@/server/workbook'
import { featureGoneJson } from '@/server/features'

export const dynamic = 'force-dynamic'

/** A learner's workbook for their mentor, their portal admin or the master. The learner id is checked, never trusted. */
export async function GET(req: Request, { params }: { params: Promise<{ learnerId: string }> }) {
  const session = await getSession()
  if (!session.actor) return json({ error: 'Sign in first.' }, 401)
  const id = Number((await params).learnerId)
  const learner = Number.isInteger(id) && id > 0 ? ((await session.payload.findByID({ collection: 'users', id, overrideAccess: true, depth: 0 }).catch(() => null)) as SessionUser | null) : null
  if (!learner || learner.role !== 'learner') return json({ error: 'That learner could not be found.' }, 404)
  if (!(await mayReadWorkbook(session.payload, session.actor, learner))) return json({ error: 'That workbook is not yours to read.' }, 403)
  const portal = await portalOf(session, req)
  const gone = featureGoneJson(portal, 'workbook')
  if (gone) return gone
  const book = await workbookFor(session.payload, learner, session.actor)
  if (new URL(req.url).searchParams.get('format') === 'csv') {
    return new Response(workbookCsv(book), {
      headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="workbook-${learner.id}.csv"`, 'cache-control': 'no-store' },
    })
  }
  return json(book)
}
