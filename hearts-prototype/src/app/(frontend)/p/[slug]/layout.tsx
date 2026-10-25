import type { CSSProperties, ReactNode } from 'react'
import { lookStyle } from '@/lib/portal-look'
import { getPayloadClient, loadPortal } from '@/server/context'

/** The portal's scene and mark cascade into every learner and desk screen under this address. */
export default async function PortalLook({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let style: CSSProperties = { '--scene': 'none', '--lattice': 'none' } as CSSProperties
  try {
    const payload = await getPayloadClient()
    const portal = await loadPortal(payload, slug)
    if (portal) style = lookStyle(portal) as CSSProperties
  } catch {
    // A missing portal still renders the page's own not-found.
  }
  return (
    <div className="portal-look" style={style}>
      {children}
    </div>
  )
}
