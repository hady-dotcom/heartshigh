import { ImageResponse } from 'next/og'
import { getSession } from '@/server/context'
import { publicView } from '@/server/gather'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { payload } = await getSession()
  const view = await publicView(payload, slug)
  const title = view?.card.title || 'Gather'
  const when = view?.card.when || ''
  const place = view?.card.place || view?.portalName || ''
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#0f3b3a', color: '#f7eedb', padding: '64px', fontFamily: 'Georgia, serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', fontSize: 28, letterSpacing: 4, color: '#d4a84b' }}>GATHER</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 68, lineHeight: 1.05, maxWidth: 980 }}>{title}</div>
            <div style={{ display: 'flex', fontSize: 32, marginTop: 24, color: '#e7d7b0' }}>{when}</div>
            <div style={{ display: 'flex', fontSize: 28, marginTop: 8 }}>{place}</div>
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: '#d4a84b' }}>{view?.portalName || 'HEARTS'}</div>
        </div>
      </div>
    ),
    size,
  )
}
