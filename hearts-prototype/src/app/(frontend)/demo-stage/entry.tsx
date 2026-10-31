import { Flash, Hidden } from '@/components/app/shell'
import { TurnstileField } from '@/components/app/turnstile-field'
import { DEMO_STAGE_PATH } from '@/lib/demo-stage-gate'
import './entry.css'

const ROLES = [
  { id: 'master', label: 'Master', colour: '#25214a' },
  { id: 'portal', label: 'Portal admin', colour: 'var(--hh-accent)' },
  { id: 'teacher', label: 'Teacher', colour: 'var(--hh-accent-deep)' },
  { id: 'learner', label: 'Learner', colour: 'var(--hh-accent)' },
] as const

export function DemoStageEntry() {
  return (
    <main className="demo-stage-entry" data-testid="demo-stage-entry">
      <div className="demo-stage-entry-card">
        <div className="demo-stage-dots" aria-label="Master, portal admin, teacher, learner">
          {ROLES.map((role) => (
            <span
              key={role.id}
              className="demo-stage-dot"
              style={{ background: role.colour }}
              role="img"
              aria-label={role.label}
              data-testid={`demo-stage-dot-${role.id}`}
            />
          ))}
        </div>
        <h1>Hady Core Demo stage</h1>
        <p className="demo-stage-entry-line">A live four-screen walk-through: master, portal admin, teacher, learner. Practice data only. Nothing here changes real portals.</p>
        <form action="/login" method="get">
          <input type="hidden" name="next" value={DEMO_STAGE_PATH} />
          <input type="hidden" name="demo" value="stage" />
          <button className="demo-stage-entry-go" type="submit" data-testid="demo-stage-sign-in">Sign in to open the Demo stage</button>
        </form>
      </div>
    </main>
  )
}

export function DemoStageLogin({ error, notice }: { error?: string; notice?: string }) {
  return (
    <main className="demo-stage-entry" data-testid="login" data-demo="stage">
      <div className="demo-stage-entry-card">
        <p className="demo-stage-kicker">Demo</p>
        <h1>Master login</h1>
        <p className="demo-stage-entry-line">This sign-in is for the demo. It uses the master login and returns you to the Demo stage.</p>
        <Flash error={error} notice={notice} />
        <form className="demo-stage-entry-form" action="/api/hearts" method="post">
          <Hidden fields={{ action: 'login', next: DEMO_STAGE_PATH }} />
          <label>Email<input className="field" data-testid="login-email" name="email" type="email" autoComplete="username" placeholder="you@example.com" required /></label>
          <label>Password<input className="field" data-testid="login-password" name="password" type="password" autoComplete="current-password" placeholder="Your password" required /></label>
          <TurnstileField />
          <button className="demo-stage-entry-go" data-testid="login-submit" type="submit">Sign in</button>
        </form>
      </div>
    </main>
  )
}
