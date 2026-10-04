import { qrPosterPdf } from '@/lib/gather-pdf'
import { AUDIENCE_LABEL, whenLabel, type Audience } from '@/lib/gather'
import { idOf, portalIdOf } from '@/lib/ids'
import { shareOrigin } from '@/lib/site-origin'
import { getSession } from '@/server/context'
import { gatheringBySlug } from '@/server/gather'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { payload, user } = await getSession()
  if (!user) return new Response('Sign in as the host.', { status: 401 })
  const row = await gatheringBySlug(payload, slug)
  if (!row) return new Response('Not found', { status: 404 })
  const portalId = idOf(row.portal)
  const host = idOf(row.host)
  const staff = user.role === 'master' || user.role === 'portal-admin' || user.role === 'teacher'
  if (user.role !== 'master' && portalIdOf(user) !== portalId) return new Response('Not your portal.', { status: 403 })
  if (!staff && host !== user.id) return new Response('The host prints the poster.', { status: 403 })
  const headerList = await headers()
  const origin = shareOrigin(headerList)
  const token = String(row.checkinToken || '')
  const url = `${origin}/gather/${slug}/in?k=${token}`
  const portal = portalId ? await payload.findByID({ collection: 'portals', id: portalId, depth: 0, overrideAccess: true }).catch(() => null) : null
  const audience = AUDIENCE_LABEL[String(row.audience || '') as Audience] || ''
  const title = String(row.title || 'Gather')
  const pdf = qrPosterPdf({
    title,
    when: whenLabel(String(row.startsAt || '')),
    place: String(row.place || ''),
    audience,
    host: String(row.hostLabel || ''),
    masjid: String((portal as { name?: string } | null)?.name || ''),
    entryCode: String(row.entryCode || ''),
    url,
  })
  const filename = `${title.replace(/[^\w .'-]+/g, '').trim().slice(0, 60) || 'Gather'} door poster.pdf`
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  })
}
