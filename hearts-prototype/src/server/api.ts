import { NextResponse } from 'next/server'
import { portalIdOf } from '@/lib/ids'
import { presentPortal } from '@/lib/portal-public'
import { loadPortal, type PortalDoc, type Session } from './context'
import { READ_ONLY, blocked } from './viewas'

export const noStore = { 'cache-control': 'no-store' }

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: noStore })
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  const type = req.headers.get('content-type') || ''
  if (type.includes('application/json')) return ((await req.json().catch(() => null)) as Record<string, unknown>) || {}
  const form = await req.formData().catch(() => null)
  if (!form) return {}
  const out: Record<string, unknown> = {}
  for (const [key, value] of form.entries()) out[key] = value
  return out
}

/** The portal comes from the address (`?portal=` or the /p/<slug> page that sent the request), never a body field. */
export async function portalOf(session: Session, req: Request): Promise<PortalDoc | null> {
  const url = new URL(req.url)
  let slug = url.searchParams.get('portal') || ''
  if (!slug) slug = (req.headers.get('referer') || '').match(/\/p\/([^/?#]+)/)?.[1] || ''
  if (!slug && session.user && session.user.role !== 'master') {
    const id = portalIdOf(session.user)
    const doc = id ? await session.payload.findByID({ collection: 'portals', id, overrideAccess: true, depth: 0 }).catch(() => null) : null
    return doc ? presentPortal(doc as PortalDoc) : null
  }
  if (!slug) return null
  const portal = await loadPortal(session.payload, slug)
  if (!portal) return null
  if (session.user && session.user.role !== 'master' && portalIdOf(session.user) !== portal.id) return null
  return portal
}

/** Writes through the custom routes follow the same view-as rules as the Payload hook. */
export async function viewAsRefusal(session: Session, what: string, never = false) {
  if (!session.viewAs) return null
  if (never || !session.viewAs.writeEnabled) {
    await blocked(session.payload, session.viewAs, { route: what, never })
    return json({ error: READ_ONLY, message: 'Read-only while viewing as someone else.' }, 403)
  }
  return null
}
