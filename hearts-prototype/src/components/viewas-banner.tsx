import { getSession } from '@/server/context'
import { ViewAsBar, ViewAsEnded, ViewAsSweep } from './viewas-bar'

export async function ViewAsBanner() {
  const { viewAs, viewAsEnded } = await getSession()
  if (viewAs) {
    return (
      <>
      <script dangerouslySetInnerHTML={{ __html: `window.__HEARTS_VIEWAS=${JSON.stringify(String(viewAs.id))}` }} />
      <ViewAsBar
        name={viewAs.target.name || viewAs.target.email || 'this person'}
        sessionId={String(viewAs.id)}
        writeEnabled={viewAs.writeEnabled}
        leftMs={Math.min(viewAs.idleLeftMs, viewAs.maxLeftMs)}
        returnTo={viewAs.returnTo}
      />
      </>
    )
  }
  if (viewAsEnded) return <ViewAsEnded reason={viewAsEnded} />
  return <ViewAsSweep />
}
