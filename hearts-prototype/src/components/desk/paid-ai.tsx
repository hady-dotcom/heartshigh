import { HelpTip } from '@/components/desk/help'
import { AI_OFF_NOTE, aiSpendIsOff } from '@/lib/ai-honesty'
import { TOOL } from '@/lib/desk-help'
import { estimatePortalCalls, portalAiPerTalkLabel } from '@/lib/portal-ai'

function AiOffNote() {
  return <p className="hint" data-testid="portal-ai-off">{AI_OFF_NOTE}</p>
}

/**
 * Shown beside a desk action that can use this portal's own AI account.
 * On the master desk, or when no account is connected, the same plain note says this is a practice draft.
 * A teacher never spends. A portal admin with an account sees the call count and must confirm first.
 */
export function PortalAiChoice({
  connected,
  master = false,
  teacher = false,
  calls = 1,
}: {
  connected: boolean
  master?: boolean
  teacher?: boolean
  /** Kept so older callers can still pass a Settings link. The off note no longer needs it. */
  settingsHref?: string
  /** How many model calls this submit will make if the box is ticked. */
  calls?: number
}) {
  if (master || (!teacher && !connected)) return <AiOffNote />
  if (teacher) {
    return <p className="hint" data-testid="portal-ai-off">AI runs are for the portal admin. This uses the built-in path.</p>
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

/** The run button itself is the spend (AI steps). A master, or a portal with no account, sees the same off note as PortalAiChoice. */
export function PortalAiConfirm({ connected, master = false, calls, perTalk = 1 }: { connected: boolean; master?: boolean; calls: number | null; perTalk?: number }) {
  if (aiSpendIsOff({ master, connected })) return <AiOffNote />
  return (
    <div data-testid="portal-ai-confirm-block">
      <p className="hint" data-testid="portal-ai-estimate">{calls == null ? portalAiPerTalkLabel(perTalk) : estimatePortalCalls(calls).label}</p>
      <label className="check">
        <input type="checkbox" name="confirmAi" value="yes" data-testid="portal-ai-confirm" /> I confirm this spend on our account
      </label>
    </div>
  )
}
