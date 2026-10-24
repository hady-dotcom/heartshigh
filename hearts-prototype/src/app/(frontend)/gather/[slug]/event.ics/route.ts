import { getSession } from '@/server/context'
import { icsFor, publicView } from '@/server/gather'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { payload } = await getSession()
  const view = await publicView(payload, slug)
  if (!view) return new Response('Not found', { status: 404 })
  const headerList = await headers()
  const host = headerList.get('x-forwarded-host') || headerList.get('host') || 'localhost:3000'
  const proto = headerList.get('x-forwarded-proto') || 'http'
  const body = icsFor(view.card, `${proto}://${host}`)
  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${view.card.slug}.ics"`,
    },
  })
}
