import { Hidden } from '@/components/app/shell'
import { HelpTip } from '@/components/desk/help'
import { TOOL } from '@/lib/desk-help'

export function PersonActions({
  person,
  next,
  canRole,
  canTemp,
  canPause,
}: {
  person: { id: number; name?: string | null; role?: string | null; suspendedAt?: string | null; emailConfirmedAt?: string | null }
  next: string
  canRole?: boolean
  canTemp?: boolean
  canPause?: boolean
}) {
  return (
    <div data-testid="person-actions" style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
      {canPause ? (
        person.suspendedAt ? (
          <form action="/api/hearts" method="post">
            <Hidden fields={{ action: 'restore-person', userId: person.id, next }} />
            <button className="btn teal small" type="submit" data-testid="restore-person">Restore</button>
          </form>
        ) : (
          <details>
            <summary className="btn danger small" data-testid="suspend-open">Pause this account <HelpTip topic="suspend" place="end">{TOOL.suspend}</HelpTip></summary>
            <form className="form" action="/api/hearts" method="post" style={{ marginTop: 8, minWidth: 220 }}>
              <Hidden fields={{ action: 'suspend-person', userId: person.id, next }} />
              <label className="stack">Reason<input name="reason" required minLength={3} data-testid="suspend-reason" /></label>
              <button className="btn danger small" type="submit" data-testid="suspend-submit">Pause</button>
            </form>
          </details>
        )
      ) : null}
      {canTemp ? (
        <details>
          <summary className="btn ghost small" data-testid="temp-password-open">Set a temporary password <HelpTip topic="tempPassword" place="end">{TOOL.tempPassword}</HelpTip></summary>
          <form className="form" action="/api/hearts" method="post" style={{ marginTop: 8, minWidth: 220 }}>
            <Hidden fields={{ action: 'set-temp-password', userId: person.id, next }} />
            <label className="stack">New temporary password<input name="password" type="password" minLength={8} required data-testid="temp-password" /></label>
            <button className="btn ink small" type="submit" data-testid="temp-password-submit">Set password</button>
          </form>
        </details>
      ) : null}
      {canRole ? (
        <details>
          <summary className="btn ghost small" data-testid="change-role-open">Change role <HelpTip topic="changeRole" place="end">{TOOL.changeRole}</HelpTip></summary>
          <form className="form" action="/api/hearts" method="post" style={{ marginTop: 8, minWidth: 220 }}>
            <Hidden fields={{ action: 'change-role', userId: person.id, next }} />
            <select name="role" defaultValue={person.role || 'learner'} data-testid="change-role">
              <option value="learner">Learner</option>
              <option value="teacher">Teacher</option>
              <option value="portal-admin">Portal admin</option>
            </select>
            <button className="btn ink small" type="submit" data-testid="change-role-submit">Save role</button>
          </form>
        </details>
      ) : null}
    </div>
  )
}
