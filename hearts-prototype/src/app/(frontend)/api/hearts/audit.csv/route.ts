import { getSession } from '@/server/context'
import { json, portalOf, viewAsRefusal } from '@/server/api'
import { audit } from '@/server/audit'
import { auditSentence } from '@/lib/audit-events'
import { portalIdOf } from '@/lib/ids'

export const dynamic = 'force-dynamic'

function csvCell(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export async function GET(req: Request) {
  const session = await getSession()
  if (!session.actor) return json({ error: 'Sign in first.' }, 401)
  if (session.actor.role === 'learner' || session.actor.role === 'teacher') {
    return json({ error: 'The activity log is for portal admins and the master desk.' }, 403)
  }
  const refused = await viewAsRefusal(session, 'audit.export')
  if (refused) return refused
  const url = new URL(req.url)
  const requested = url.searchParams.get('portal')
  const portal = await portalOf(session, req)
  if (session.actor.role !== 'master' && requested && !portal) return json({ error: 'That portal is not yours.' }, 403)
  const portalId = session.actor.role === 'master' ? portal?.id || null : portalIdOf(session.actor)
  if (session.actor.role !== 'master' && !portalId) return json({ error: 'That portal is not yours.' }, 403)
  if (session.actor.role !== 'master' && requested && portal && portal.id !== portalId) {
    return json({ error: 'That portal is not yours.' }, 403)
  }
  const where: Record<string, unknown>[] = []
  if (portalId) where.push({ portal: { equals: portalId } })
  if (url.searchParams.get('person')) {
    const id = Number(url.searchParams.get('person'))
    where.push({ or: [{ actor: { equals: id } }, { target: { equals: id } }] })
  }
  if (url.searchParams.get('action')) where.push({ event: { equals: url.searchParams.get('action') } })
  if (url.searchParams.get('from')) where.push({ at: { greater_than_equal: `${url.searchParams.get('from')}T00:00:00.000Z` } })
  if (url.searchParams.get('to')) where.push({ at: { less_than_equal: `${url.searchParams.get('to')}T23:59:59.999Z` } })
  const found = await session.payload.find({
    collection: 'audit-log',
    overrideAccess: true,
    depth: 1,
    limit: 200,
    sort: '-at',
    where: where.length ? { and: where } : undefined,
  })
  if (!found.docs.length) return json({ error: 'Nobody matches this list, so the download stays still.' }, 400)
  const lines = [['when', 'event', 'sentence', 'reason'].join(',')]
  for (const row of found.docs as {
    event?: string
    actor?: { name?: string; role?: string } | null
    actorRole?: string
    target?: { name?: string } | null
    portal?: { name?: string } | null
    reason?: string
    at?: string
    detail?: Record<string, unknown>
  }[]) {
    const sentence = auditSentence({
      event: String(row.event || ''),
      actorName: row.actor?.name,
      actorRole: row.actorRole || row.actor?.role,
      targetName: row.target?.name,
      portalName: row.portal?.name,
      reason: row.reason,
      detail: row.detail,
    })
    lines.push([row.at || '', row.event || '', sentence, row.reason || ''].map((value) => csvCell(String(value))).join(','))
  }
  await audit(session.payload, 'audit.export', {
    actor: session.actor,
    actorRole: session.actor.role,
    portal: portalId,
    detail: { count: found.docs.length },
  })
  return new Response(lines.join('\n') + '\n', {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="activity-log.csv"',
      'cache-control': 'no-store',
    },
  })
}
