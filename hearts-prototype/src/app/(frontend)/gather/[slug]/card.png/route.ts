import { getSession } from '@/server/context'
import { gatherCardImage } from '@/server/gather-card'
import { publicView } from '@/server/gather'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { payload } = await getSession()
  const view = await publicView(payload, slug)
  if (!view) return new Response('Not found', { status: 404 })
  return gatherCardImage({
    title: view.card.title,
    when: view.card.when,
    place: view.card.place || view.portalName,
    portal: view.portalName,
  })
}
