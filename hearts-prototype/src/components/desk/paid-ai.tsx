import { HelpTip } from '@/components/desk/help'
import { TOOL } from '@/lib/desk-help'

/** Unticked by default. The estimate is on the page before the button is pressed. */
export function PaidAiOptIn({ hint }: { hint: string }) {
  return (
    <div data-testid="paid-ai-opt-in">
      <label className="check">
        <input type="checkbox" name="usePaidAi" value="yes" data-testid="paid-ai-tick" /> Use paid AI for this run
      </label>
      <HelpTip topic="paid-ai">{TOOL.paidAi}</HelpTip>
      <p className="hint" data-testid="paid-ai-cost">{hint}</p>
    </div>
  )
}
