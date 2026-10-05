import { getSession } from '@/server/context'
import { json, portalOf } from '@/server/api'
import { viewAsRefusal } from '@/server/api'
import { exportPersonCopy, exportPortalCopy, personSummary, portalSummary } from '@/server/erase'
import type { PersonMode } from '@/server/erase/types'

export const dynamic = 'force-dynamic'

function modeOf(value: string | null): PersonMode {
  return value === 'portal' ? 'portal' : 'account'
}

function formatOf(value: string | null): 'json' | 'xlsx' {
  return value === 'json' ? 'json' : 'xlsx'
}

export async function GET(req: Request) {
  const session = await getSession()
  if (!session.actor) return json({ error: 'Please sign in first.' }, 401)
  const refused = await viewAsRefusal(session, 'erase', true)
  if (refused) return refused
  const url = new URL(req.url)
  const scope = url.searchParams.get('scope')
  const what = url.searchParams.get('what') || 'summary'
  const format = formatOf(url.searchParams.get('format'))
  const self = url.searchParams.get('self') === '1'
  const portalFromUrl = Number(url.searchParams.get('portal'))
  const portalDoc = await portalOf(session, req)
  const portalId = Number.isInteger(portalFromUrl) && portalFromUrl > 0 ? portalFromUrl : portalDoc?.id || null

  if (scope === 'portal') {
    const id = Number(url.searchParams.get('id') || portalId)
    if (!Number.isInteger(id) || id <= 0) return json({ error: 'Name the portal.' }, 400)
    if (what === 'export') {
      const file = await exportPortalCopy(session.payload, session.actor, id, format)
      if ('error' in file) return json({ error: file.error }, 403)
      return new Response(new Uint8Array(file.body), {
        headers: {
          'content-type': file.type,
          'content-disposition': `attachment; filename="${file.filename}"`,
          'cache-control': 'no-store',
        },
      })
    }
    const summary = await portalSummary(session.payload, session.actor, id)
    if ('error' in summary) return json({ error: summary.error }, 403)
    return json(summary)
  }

  if (scope === 'user') {
    const id = self ? session.actor.id : Number(url.searchParams.get('id'))
    if (!Number.isInteger(id) || id <= 0) return json({ error: 'Name the person.' }, 400)
    const mode = modeOf(url.searchParams.get('mode'))
    if (what === 'export') {
      const file = await exportPersonCopy(session.payload, session.actor, id, portalId, mode, format, self)
      if ('error' in file) return json({ error: file.error }, 403)
      return new Response(new Uint8Array(file.body), {
        headers: {
          'content-type': file.type,
          'content-disposition': `attachment; filename="${file.filename}"`,
          'cache-control': 'no-store',
        },
      })
    }
    const summary = await personSummary(session.payload, session.actor, id, portalId, mode, self)
    if ('error' in summary) return json({ error: summary.error }, 403)
    return json(summary)
  }

  return json({ error: 'Say whether this is a portal or a person.' }, 400)
}
