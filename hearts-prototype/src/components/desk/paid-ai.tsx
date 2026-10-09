import { HelpTip } from '@/components/desk/help'
import { TOOL } from '@/lib/desk-help'

/**
 * Shown beside a desk action that can use this portal's own AI account.
 * With no connection, or on the master desk, the box is absent and the built-in path runs.
 */
export function PortalAiChoice({
  connected,
  master = false,
  settingsHref,
}: {
  connected: boolean
  master?: boolean
  settingsHref?: string
}) {
  if (master) {
    return <p className="hint" data-testid="portal-ai-off">The master desk does not call a model. This uses the built-in path.</p>
  }
  if (!connected) {
    return (
      <p className="hint" data-testid="portal-ai-off">
        AI is off for this portal. A portal admin connects their own account in {settingsHref ? <a href={settingsHref}>Settings</a> : 'Settings'}. This uses the built-in path.
      </p>
    )
  }
  return (
    <div data-testid="portal-ai-opt-in">
      <label className="check">
        <input type="checkbox" name="usePortalAi" value="yes" data-testid="portal-ai-tick" /> Use this portal’s AI account for this run
      </label>
      <HelpTip topic="portal-ai">{TOOL.portalAi}</HelpTip>
    </div>
  )
}
