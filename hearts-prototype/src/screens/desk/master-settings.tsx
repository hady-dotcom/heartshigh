import { EmailPanel } from '@/components/desk/email-panel'
import { TwoStepPanel } from '@/components/desk/two-step-panel'
import { Hidden } from '@/components/app/shell'
import { rows } from '../common'
import { MasterFrame, type MasterCtx } from './master'

export async function MasterSettings(ctx: MasterCtx) {
  const people = await rows(ctx.payload, 'users', { role: { in: ['master', 'portal-admin'] } }, { limit: 200, sort: 'email' })
  return (
    <MasterFrame ctx={ctx} active="settings" title="Settings" intro="Email transport and two-step sign-in. These are rare, powerful tools." testId="master-settings">
      <EmailPanel next="/master/settings" />
      <TwoStepPanel enabled={Boolean(ctx.user.totpEnabledAt)} next="/master/settings" />
      <section className="panel" data-testid="reset-2fa">
        <header className="light"><h2>Reset someone’s two-step sign-in</h2></header>
        <form className="body form" action="/api/hearts" method="post">
          <Hidden fields={{ action: 'reset-totp', next: '/master/settings' }} />
          <label className="stack">Person
            <select name="userId" data-testid="reset-2fa-user">
              {people.map((person) => <option key={person.id} value={person.id}>{String(person.name || person.email)} ({String(person.email)})</option>)}
            </select>
          </label>
          <label className="stack">Reason<input name="reason" required minLength={3} data-testid="reset-2fa-reason" /></label>
          <button className="btn danger" type="submit" data-testid="reset-2fa-submit">Reset two-step</button>
        </form>
      </section>
    </MasterFrame>
  )
}
