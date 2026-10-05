import { Hidden } from '@/components/app/shell'
import { HelpTip } from '@/components/desk/help'
import { TOOL } from '@/lib/desk-help'

export function PersonActions({
  person,
  next,
  canRole,
  canTemp,
  canPause,
  pausedWhen,
}: {
  person: { id: number; name?: string | null; role?: string | null; suspendedAt?: string | null; emailConfirmedAt?: string | null }
  next: string
  canRole?: boolean
  canTemp?: boolean
  canPause?: boolean
  pausedWhen?: string
}) {
  if (!canPause && !canTemp && !canRole) return null
  return (
    <details data-testid="person-actions" style={{ position: 'relative', justifySelf: 'end' }}>
      <summary className="btn ghost small" data-testid="person-account-open">
        Account <HelpTip topic="suspend" place="end">{TOOL.suspend}</HelpTip>
      </summary>
      <div className="form" style={{ position: 'absolute', right: 0, zIndex: 6, marginTop: 8, width: 168, display: 'grid', gap: 8 }}>
        {canPause ? (
          person.suspendedAt ? (
            <form action="/api/hearts" method="post">
              <Hidden fields={{ action: 'restore-person', userId: person.id, next }} />
              {pausedWhen ? <p className="hint" data-testid="paused-when">Paused {pausedWhen}</p> : null}
              <button className="btn teal small" type="submit" data-testid="restore-person">Restore</button>
            </form>
          ) : (
            <form action="/api/hearts" method="post">
              <Hidden fields={{ action: 'suspend-person', userId: person.id, next }} />
              <label className="stack">
                Pause
                <input name="reason" required minLength={3} data-testid="suspend-reason" placeholder="Reason" />
              </label>
              <button className="btn danger small" type="submit" data-testid="suspend-open">Pause</button>
            </form>
          )
        ) : null}
        {canTemp ? (
          <form action="/api/hearts" method="post">
            <Hidden fields={{ action: 'set-temp-password', userId: person.id, next }} />
            <label className="stack">
              Temporary password
              <input name="password" type="password" minLength={8} required data-testid="temp-password" />
            </label>
            <button className="btn ink small" type="submit" data-testid="temp-password-open">Set password</button>
          </form>
        ) : null}
        {canRole ? (
          <form action="/api/hearts" method="post">
            <Hidden fields={{ action: 'change-role', userId: person.id, next }} />
            <label className="stack">
              Role
              <select name="role" defaultValue={person.role || 'learner'} data-testid="change-role">
                <option value="learner">Learner</option>
                <option value="teacher">Teacher</option>
                <option value="portal-admin">Portal admin</option>
              </select>
            </label>
            <button className="btn ink small" type="submit" data-testid="change-role-open">Save role</button>
          </form>
        ) : null}
      </div>
    </details>
  )
}
