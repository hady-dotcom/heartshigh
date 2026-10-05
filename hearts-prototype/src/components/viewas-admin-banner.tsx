import { getSession } from '@/server/context'

/** The view-as bar inside the Payload admin. Exit and the timers live on the Hady Core screens. */
export async function ViewAsAdminBanner() {
  const { viewAs } = await getSession()
  if (!viewAs) return null
  const minutes = Math.ceil(Math.min(viewAs.idleLeftMs, viewAs.maxLeftMs) / 60_000)
  return (
    <div
      role="status"
      data-testid="viewas-banner"
      style={{ position: 'sticky', top: 0, zIndex: 1000, background: '#e3b23c', color: '#1f1d36', padding: '10px 16px', font: '600 14px/1.4 system-ui, sans-serif', display: 'flex', gap: 16, justifyContent: 'space-between', flexWrap: 'wrap' }}
    >
      <span data-testid="viewas-text">
        Viewing as {viewAs.target.name || viewAs.target.email}. <a href="/api/view-as/exit-redirect" style={{ color: '#1f1d36', textDecoration: 'underline' }} data-testid="viewas-exit">Exit</a>
      </span>
      <span>
        <span data-testid="viewas-mode">{viewAs.writeEnabled ? 'Changes allowed' : 'Read-only'}</span> · {minutes} min left
      </span>
    </div>
  )
}
