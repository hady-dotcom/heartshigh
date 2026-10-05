import { Hidden } from '@/components/app/shell'
import { HelpTip } from '@/components/desk/help'
import { TOOL } from '@/lib/desk-help'

export function EmailJoinLink({ codeId, shareUrl, portalName, next }: { codeId: number; shareUrl: string; portalName: string; next: string }) {
  return (
    <details data-testid="email-join">
      <summary className="btn ghost small">Email this link <HelpTip topic="emailJoin" place="end">{TOOL.emailJoin}</HelpTip></summary>
      <form className="form" action="/api/hearts" method="post" style={{ marginTop: 8, minWidth: 260 }}>
        <Hidden fields={{ action: 'email-join-link', codeId, next }} />
        <p className="hint">People get a short note from {portalName} and this button: {shareUrl}</p>
        <label className="stack">Addresses (up to 200)<textarea name="emails" rows={4} required data-testid="join-emails" placeholder="one@example.com" /></label>
        <button className="btn ink small" type="submit" data-testid="email-join-submit">Send</button>
      </form>
    </details>
  )
}
