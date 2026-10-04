import { qrPosterPdf } from '@/lib/gather-pdf'
import { whenLabel } from '@/lib/gather'
import { idOf, portalIdOf } from '@/lib/ids'
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
  const hostName = headerList.get('x-forwarded-host') || headerList.get('host') || 'localhost:3000'
  const proto = headerList.get('x-forwarded-proto') || 'http'
  const token = String(row.checkinToken || '')
  const url = `${proto}://${hostName}/gather/${slug}/in?k=${token}`
  const pdf = qrPosterPdf({
    title: String(row.title || 'Gather'),
    when: whenLabel(String(row.startsAt || '')),
    place: String(row.place || ''),
    url,
  })
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${slug}-door.pdf"`,
    },
  })
}
