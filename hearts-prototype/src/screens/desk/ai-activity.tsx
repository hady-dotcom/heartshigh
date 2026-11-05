import { Hidden } from '@/components/app/shell'
import { compactSide, roleWords, type SideLine } from '@/lib/ai-steps'
import type { PortalChangeView, PortalGroupView, PortalRunView } from '@/server/ai-desk'
import styles from './ai.module.css'

type Query = Record<string, string | undefined>

function when(value: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
}

function pretty(value: unknown) {
  if (value == null) return 'No draft was saved.'
  return JSON.stringify(value, null, 2)
}

function Lines({ lines }: { lines: SideLine[] }) {
  return (
    <div className={styles.diff}>
      {lines.map((line, index) => (
        <div key={index} className={line.kind === 'add' ? styles.add : line.kind === 'del' ? styles.del : line.kind === 'skip' ? styles.skip : undefined} data-kind={line.kind}>
          {line.kind === 'add' ? '+ ' : line.kind === 'del' ? '− ' : line.kind === 'skip' ? '' : '  '}
          {line.text || ' '}
        </div>
      ))}
    </div>
  )
}

function Pair({ before, after }: { before: string; after: string }) {
  const view = compactSide(before, after)
  return (
    <div className={styles.pair} data-testid="portal-diff">
      <div>
        <b>Before</b>
        <Lines lines={view.before} />
      </div>
      <div>
        <b>After</b>
        <Lines lines={view.after} />
      </div>
    </div>
  )
}

function Change({ change, base }: { change: PortalChangeView; base: string }) {
  const who = [change.authorName, roleWords(change.authorRole)].filter(Boolean).join(', ')
  return (
    <article className={styles.change} data-testid="portal-change" data-slug={change.stepSlug} data-live={change.live ? 'yes' : 'no'} data-kept={change.kept ? 'yes' : 'no'} data-rolled={change.rolledBack ? 'yes' : 'no'}>
      <p><b>{change.stepName}</b></p>
      <p>{who} · {when(change.at)}</p>
      <p>Their note: {change.note || 'No note added.'}</p>
      {change.rolledBack ? <p data-testid="portal-rolled">Rolled back. This portal is not using this wording now.</p> : null}
      {change.kept && !change.rolledBack ? <p data-testid="portal-kept">You kept this change.</p> : null}
      {change.live && !change.rolledBack ? <p>This portal is using this wording now.</p> : null}
      <Pair before={change.before} after={change.after} />
      <div className="actions">
        <form action="/api/ai-steps" method="post">
          <Hidden fields={{ action: 'portal-rollback', version: change.id, next: base }} />
          <button className="btn small ghost" type="submit" data-testid="portal-rollback">Roll back</button>
        </form>
        <form action="/api/ai-steps" method="post">
          <Hidden fields={{ action: 'portal-keep', version: change.id, next: base }} />
          <button className="btn small teal" type="submit" data-testid="portal-keep">Keep</button>
        </form>
      </div>
    </article>
  )
}

function Run({ run }: { run: PortalRunView }) {
  return (
    <article className={styles.change} data-testid="portal-run" data-slug={run.stepSlug} data-ok={run.ok ? 'yes' : 'no'}>
      <p><b>{run.stepName}</b> · {run.talk}</p>
      <p>{run.who} · {when(run.at)} · {run.ok ? 'Worked' : 'Did not work'}</p>
      <details data-testid="portal-run-output">
        <summary>Read the draft</summary>
        <pre className={styles.schema}>{pretty(run.output)}</pre>
      </details>
    </article>
  )
}

function Group({ group, base }: { group: PortalGroupView; base: string }) {
  return (
    <details className={styles.group} data-testid="portal-group" data-portal={group.portalId} data-fresh={group.fresh} open>
      <summary>
        <b>{group.portalName}</b>
        <span>{group.changes.length} {group.changes.length === 1 ? 'change' : 'changes'}</span>
        <span>Last change {when(group.lastAt) || '—'}</span>
        {group.fresh ? <span data-testid="portal-group-new">{group.fresh} new since you last looked</span> : null}
      </summary>
      <div className={styles.groupBody}>
        {group.changes.length ? group.changes.map((change) => <Change key={change.id} change={change} base={base} />) : <p>This portal has not changed a step. It is still using the HEARTS wording.</p>}
        <h3>What this portal ran</h3>
        <p className={styles.quiet}>Each row is one run: the step, the talk, when, who, and whether it worked. Open a row to read the draft. Learners do not see a draft until a person approves it.</p>
        {group.runs.length ? group.runs.map((run) => <Run key={run.id} run={run} />) : <p data-testid="portal-runs-empty">This portal has not run a step yet.</p>}
      </div>
    </details>
  )
}

const EXAMPLE_BEFORE = 'Pick a clip of 15 to 30 seconds.\nCopy the speaker’s words.'
const EXAMPLE_AFTER = 'Pick a clip of 15 to 30 seconds.\nPrefer a line a stranger would repeat.\nCopy the speaker’s words.'

function Example({ base }: { base: string }) {
  return (
    <div className={styles.example} data-testid="portal-activity-example">
      <p><b>Example.</b> No portal has changed a step yet. This is what one change looks like. The buttons are real, and they do not change any step.</p>
      <details className={styles.group} open>
        <summary>
          <b>Example portal</b>
          <span>1 change</span>
          <span>Last change just now</span>
        </summary>
        <div className={styles.groupBody}>
          <article className={styles.change}>
            <p><b>Hors d&apos;oeuvre picker</b></p>
            <p>A portal admin · just now</p>
            <p>Their note: Asked for a shorter opening a stranger could follow.</p>
            <Pair before={EXAMPLE_BEFORE} after={EXAMPLE_AFTER} />
            <div className="actions">
              <form action="/api/ai-steps" method="post">
                <Hidden fields={{ action: 'portal-example', which: 'rollback', next: base }} />
                <button className="btn small ghost" type="submit" data-testid="portal-rollback">Roll back</button>
              </form>
              <form action="/api/ai-steps" method="post">
                <Hidden fields={{ action: 'portal-example', which: 'keep', next: base }} />
                <button className="btn small teal" type="submit" data-testid="portal-keep">Keep</button>
              </form>
            </div>
          </article>
          <h3>What this portal ran</h3>
          <article className={styles.change} data-testid="portal-run" data-ok="yes">
            <p><b>Pop-up question drafter</b> · How to live like the Prophet</p>
            <p>A portal admin · just now · Worked</p>
            <details data-testid="portal-run-output">
              <summary>Read the draft</summary>
              <pre className={styles.schema}>{pretty({ points: [{ second: 120, kind: 'question', prompt: 'What is one thing you will leave unsaid this week?', options: [] }] })}</pre>
            </details>
          </article>
        </div>
      </details>
    </div>
  )
}

export function PortalActivity({
  base,
  query,
  fresh,
  hasAny,
  groups,
  portals,
  steps,
}: {
  base: string
  query: Query
  fresh: number
  hasAny: boolean
  groups: PortalGroupView[]
  portals: { id: number; name: string }[]
  steps: { slug: string; name: string }[]
}) {
  return (
    <section className={styles.activity} data-testid="portal-activity">
      <h2>What portals are doing</h2>
      <p>A portal can change a step for its own people. HEARTS stays the same for every other portal. Open a portal to see who changed what, and what their AI wrote.</p>
      <p data-testid="portal-activity-new">{fresh ? `${fresh} new since you last looked` : 'Nothing new since you last looked'}</p>
      <form className={styles.filters} method="get" action={base} data-testid="portal-filters">
        <label>Portal
          <select name="portal" defaultValue={query.portal || ''} data-testid="portal-filter-portal">
            <option value="">Every portal</option>
            {portals.map((portal) => <option key={portal.id} value={String(portal.id)}>{portal.name}</option>)}
          </select>
        </label>
        <label>Step
          <select name="step" defaultValue={query.step || ''} data-testid="portal-filter-step">
            <option value="">Every step</option>
            {steps.map((step) => <option key={step.slug} value={step.slug}>{step.name}</option>)}
          </select>
        </label>
        <label>Date
          <input name="on" type="date" defaultValue={query.on || ''} data-testid="portal-filter-date" />
        </label>
        <button className="btn ghost small" type="submit">Show</button>
      </form>
      {hasAny ? groups.map((group) => <Group key={group.portalId} group={group} base={base} />) : <Example base={base} />}
      {hasAny && !groups.length ? <p data-testid="portal-activity-empty">Nothing from that filter. Try another portal, step, or date.</p> : null}
    </section>
  )
}
