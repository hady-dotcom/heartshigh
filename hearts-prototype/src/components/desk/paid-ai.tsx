import { HelpTip } from '@/components/desk/help'
import { TOOL } from '@/lib/desk-help'
import { estimatePortalCalls, portalAiPerTalkLabel } from '@/lib/portal-ai'

/**
 * Shown beside a desk action that can use this portal's own AI account.
 * With no connection, on the master desk, or for a teacher, the box is absent and the built-in path runs.
 * A portal admin sees the call count, a rough estimate, and must confirm before the run.
 */
export function PortalAiChoice({
  connected,
  master = false,
  teacher = false,
  settingsHref,
  calls = 1,
}: {
  connected: boolean
  master?: boolean
  teacher?: boolean
  settingsHref?: string
  /** How many model calls this submit will make if the box is ticked. */
  calls?: number
}) {
  if (master) {
    return <p className="hint" data-testid="portal-ai-off">The master desk does not call a model. This uses the built-in path.</p>
  }
  if (teacher) {
    return <p className="hint" data-testid="portal-ai-off">AI runs are for the portal admin. This uses the built-in path.</p>
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
      <p className="hint" data-testid="portal-ai-estimate">{estimatePortalCalls(calls).label}</p>
      <label className="check">
        <input type="checkbox" name="usePortalAi" value="yes" data-testid="portal-ai-tick" /> Use this portal’s AI account for this run
      </label>
      <label className="check">
        <input type="checkbox" name="confirmAi" value="yes" data-testid="portal-ai-confirm" /> I confirm this spend on our account
      </label>
      <HelpTip topic="portal-ai">{TOOL.portalAi}</HelpTip>
    </div>
  )
}

/** The run button itself is the spend (AI steps). Shown only to a portal admin with a connection. */
export function PortalAiConfirm({ connected, master = false, calls, perTalk = 1 }: { connected: boolean; master?: boolean; calls: number | null; perTalk?: number }) {
  if (master || !connected) return null
  return (
    <div data-testid="portal-ai-confirm-block">
      <p className="hint" data-testid="portal-ai-estimate">{calls == null ? portalAiPerTalkLabel(perTalk) : estimatePortalCalls(calls).label}</p>
      <label className="check">
        <input type="checkbox" name="confirmAi" value="yes" data-testid="portal-ai-confirm" /> I confirm this spend on our account
      </label>
    </div>
  )
}
