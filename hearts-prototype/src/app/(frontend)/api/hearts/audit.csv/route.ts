import { getSession } from '@/server/context'
import { json, portalOf, viewAsRefusal } from '@/server/api'
import { audit } from '@/server/audit'
import { auditSentence } from '@/lib/audit-events'
import { portalIdOf } from '@/lib/ids'
import { DEFAULT_TIME_ZONE, portalTimeZone, ymdFromParts, zonedDayRange, zonedIso } from '@/lib/zone-time'

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
  const timeZone = portal ? portalTimeZone(portal) : DEFAULT_TIME_ZONE
  const fromDay = ymdFromParts(url.searchParams.get('fromYear') || '', url.searchParams.get('fromMonth') || '', url.searchParams.get('fromDay') || '') || url.searchParams.get('from') || ''
  const toDay = ymdFromParts(url.searchParams.get('toYear') || '', url.searchParams.get('toMonth') || '', url.searchParams.get('toDay') || '') || url.searchParams.get('to') || ''
  const where: Record<string, unknown>[] = []
  if (portalId) where.push({ portal: { equals: portalId } })
  if (url.searchParams.get('person')) {
    const id = Number(url.searchParams.get('person'))
    where.push({ or: [{ actor: { equals: id } }, { target: { equals: id } }] })
  }
  if (url.searchParams.get('action')) where.push({ event: { equals: url.searchParams.get('action') } })
  const from = fromDay ? zonedDayRange(fromDay, timeZone) : null
  const to = toDay ? zonedDayRange(toDay, timeZone) : null
  if (from) where.push({ at: { greater_than_equal: from.from } })
  if (to) where.push({ at: { less_than_equal: to.to } })
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
    lines.push([zonedIso(row.at, timeZone), row.event || '', sentence, row.reason || ''].map((value) => csvCell(String(value))).join(','))
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
