import { getSession } from '@/server/context'
import { gatherCardImage } from '@/server/gather-card'
import { publicView } from '@/server/gather'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { payload } = await getSession()
  const view = await publicView(payload, slug)
  return gatherCardImage({
    title: view?.card.title || 'Gather',
    when: view?.card.when || '',
    place: view?.card.place || view?.portalName || '',
    portal: view?.portalName || 'HEARTS',
  })
}
