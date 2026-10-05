import { Hidden } from '@/components/app/shell'
import { HelpTip } from '@/components/desk/help'
import { TOOL } from '@/lib/desk-help'

export function TwoStepPanel({ enabled, next }: { enabled: boolean; next: string }) {
  return (
    <section className="panel" data-testid="two-step-panel">
      <header className="light"><h2>Two-step sign-in <HelpTip topic="twoStep">{TOOL.twoStep}</HelpTip></h2></header>
      <div className="body">
        <p>{enabled ? 'A code from an app on your phone is required after your password.' : 'Master and portal admins should turn this on. Sign out and sign in to set it up, or open /login/setup after your password.'}</p>
        {!enabled ? (
          <form action="/api/hearts" method="post">
            <Hidden fields={{ action: 'begin-two-step', next }} />
            <button className="btn ink" type="submit" data-testid="two-step-start">Set it up now</button>
          </form>
        ) : (
          <p className="hint">To change the app, ask the master desk to reset two-step sign-in.</p>
        )}
      </div>
    </section>
  )
}
