import { Hidden } from '@/components/app/shell'
import { HelpTip } from '@/components/desk/help'
import { TOOL } from '@/lib/desk-help'
import { retentionTable } from '@/lib/retention'
import { closedPortalReminders, systemSnapshot } from '@/server/ops'
import { MasterFrame, type MasterCtx } from './master'

function Status({ status }: { status: string }) {
  const label = status === 'ok' ? 'Fine' : status === 'off' ? 'Off' : status === 'warn' ? 'Needs a look' : 'Down'
  const tone = status === 'ok' ? 'teal' : status === 'off' ? 'grey' : status === 'warn' ? 'gold' : 'rose'
  return <span className={`badge ${tone}`} data-testid="health-flag">{label}</span>
}

export async function SystemScreen(ctx: MasterCtx) {
  const snapshot = await systemSnapshot(ctx.payload)
  const reminders = await closedPortalReminders(ctx.payload)
  const checks = [snapshot.database, snapshot.storage, snapshot.email, snapshot.jobs, snapshot.backup, snapshot.restore]
  return (
    <MasterFrame ctx={ctx} active="system" title="System" intro="Whether the database, files, mail and backups are answering. Personal data is not shown here." testId="master-system">
      <section className="panel" style={{ marginBottom: 18 }} data-testid="system-health">
        <header>
          <div>
            <h2>Health <HelpTip topic="system-health">{TOOL.systemHealth}</HelpTip></h2>
            <p>App version {snapshot.version}. Checked {snapshot.checkedAt.replace('T', ' ').slice(0, 16)} UTC.</p>
          </div>
        </header>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Part</th><th>State</th><th>Note</th></tr></thead>
            <tbody>
              {checks.map((check) => (
                <tr key={check.key} data-testid={`health-${check.key}`}>
                  <td>{check.label}</td>
                  <td><Status status={check.status} /></td>
                  <td>{check.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel" style={{ marginBottom: 18 }} data-testid="system-retention">
        <header>
          <div>
            <h2>How long we keep things <HelpTip topic="retention">{TOOL.retention}</HelpTip></h2>
            <p>A nightly job carries this out. The privacy notice should use the same table.</p>
          </div>
        </header>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>What</th><th>Kept for</th><th>Why</th></tr></thead>
            <tbody>
              {retentionTable().map((row) => (
                <tr key={row.id} data-testid="retention-row">
                  <td>{row.label}</td>
                  <td>{row.keep}</td>
                  <td>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form className="form" action="/api/hearts" method="post" style={{ margin: 16 }}>
          <Hidden fields={{ action: 'retention-run', next: '/master/system' }} />
          <button className="btn ghost small" type="submit" data-testid="retention-run">Run the clean-up now</button>
        </form>
      </section>
      <section className="panel" data-testid="system-closed">
        <header><div><h2>Closed portals to look at ({reminders.length})</h2><p>After 90 days the master is asked to wipe or keep. Nothing is deleted from here.</p></div></header>
        <div className="body">
          {reminders.map((row) => (
            <p key={row.id} data-testid="closed-portal-reminder">
              {typeof row.portal === 'object' ? row.portal?.name || row.portal?.slug : 'A portal'} — {row.detail?.message}
            </p>
          ))}
          {!reminders.length ? <p className="empty">No closed portal is waiting.</p> : null}
        </div>
      </section>
    </MasterFrame>
  )
}
