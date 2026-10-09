import Link from 'next/link'
import type { Payload } from 'payload'
import { Hidden } from '@/components/app/shell'
import { ExperimentForm } from '@/components/desk/experiment-form'
import { ExperimentHelp } from '@/components/desk/help'
import { LocalWhen, LocalZoneNote } from '@/components/desk/local-when'
import {
  EXPERIMENT_RULE,
  EXPERIMENT_SLOTS,
  PRIMARY_METRICS,
  experimentAuditLine,
  metricLabel,
  variantCopy,
} from '@/lib/experiment-slots'
import type { SessionUser } from '@/server/context'
import {
  canEditExperiments,
  canViewExperiments,
  ensureStarterExperiments,
  experimentAudit,
  experimentsKilled,
  listExperiments,
  loadExperiment,
  resultsFor,
  type ExperimentDoc,
  type ExperimentResults,
} from '@/server/experiments'
import { rows, str } from '../common'
import type { Ctx } from '../common'
import { AdminFrame } from './overview'
import { DeskFrame, masterNav } from './shell'
import styles from './experiments.module.css'

type Query = Record<string, string | string[] | undefined>

function queryText(query: Query, key: string) {
  const value = query[key]
  return typeof value === 'string' ? value : Array.isArray(value) ? value[0] || '' : ''
}

const STATUS_BADGE: Record<string, [string, string]> = {
  draft: ['Draft', 'grey'],
  running: ['Running', 'teal'],
  paused: ['Paused', 'gold'],
  finished: ['Finished', 'ink'],
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`
}

function atIso(value: unknown) {
  if (!value) return ''
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

async function Frame({
  ctx,
  master,
  title,
  intro,
  testId,
  tools,
  children,
}: {
  ctx: Ctx | null
  master: { payload: Payload; user: SessionUser; query: Query } | null
  title: string
  intro: string
  testId: string
  tools?: React.ReactNode
  children: React.ReactNode
}) {
  const withHelp = (
    <>
      <ExperimentHelp />
      {tools}
    </>
  )
  if (ctx) return <AdminFrame ctx={ctx} active="experiments" title={title} intro={intro} testId={testId} tools={withHelp}>{children}</AdminFrame>
  const desk = master!
  return (
    <DeskFrame payload={desk.payload} user={desk.user} title={title} intro={intro} active="experiments" nav={masterNav()} brand="HEARTS" subBrand="Master desk" brandHref="/master" query={desk.query} testId={testId} tools={withHelp}>
      {children}
    </DeskFrame>
  )
}

function queryOf(ctx: Ctx | null, master: { query: Query } | null) {
  return (ctx?.query || master?.query || {}) as Query
}

export async function ExperimentPages({ ctx, master, path }: { ctx?: Ctx | null; master?: { payload: Payload; user: SessionUser; query: Query } | null; path: string[] }) {
  const payload = ctx?.payload || master!.payload
  const user = ctx?.user || master!.user
  const query = queryOf(ctx || null, master || null)
  const base = ctx ? `${ctx.base}/admin/experiments` : '/master/experiments'
  if (!canViewExperiments(user)) {
    return <Frame ctx={ctx || null} master={master || null} title="Experiments" intro="" testId="experiments-denied"><p>Experiments are for the master desk and portal admins.</p></Frame>
  }
  await ensureStarterExperiments(payload, user)
  const [head, rest] = path
  if (head === 'new') return <EditPage ctx={ctx || null} master={master || null} base={base} fromInsight={query} />
  if (head && rest === 'edit') return <EditPage ctx={ctx || null} master={master || null} base={base} id={Number(head)} />
  if (head) return <DetailPage ctx={ctx || null} master={master || null} base={base} id={head} suggest={queryText(query, 'suggest') === '1'} error={queryText(query, 'error')} />
  return <ListPage ctx={ctx || null} master={master || null} base={base} />
}

function Rule() {
  return (
    <aside className={styles.rule} data-testid="experiment-rule">
      <b>What may be tested</b>
      <p className={styles.quiet} style={{ margin: 0 }}>{EXPERIMENT_RULE} Only slots on the registry can run. Learners are never told they are in a test, and nothing extra about them is stored.</p>
    </aside>
  )
}

async function ListPage({ ctx, master, base }: { ctx: Ctx | null; master: { payload: Payload; user: SessionUser; query: Query } | null; base: string }) {
  const payload = ctx?.payload || master!.payload
  const user = ctx?.user || master!.user
  const items = await listExperiments(payload, user)
  const killed = await experimentsKilled(payload)
  const counts = {
    running: items.filter((row) => row.status === 'running').length,
    draft: items.filter((row) => row.status === 'draft').length,
    paused: items.filter((row) => row.status === 'paused').length,
    finished: items.filter((row) => row.status === 'finished').length,
  }
  const groups: { key: ExperimentDoc['status']; title: string }[] = [
    { key: 'running', title: 'Running' },
    { key: 'draft', title: 'Drafts' },
    { key: 'paused', title: 'Paused' },
    { key: 'finished', title: 'Finished' },
  ]
  const masterUser = user.role === 'master'
  return (
    <Frame
      ctx={ctx}
      master={master}
      title="Experiments"
      intro="Test small words, buttons and layouts as learners use the app, and let the winners take over."
      testId="experiments-desk"
      tools={masterUser ? <Link className="btn" href={`${base}/new`} data-testid="experiment-new">New experiment</Link> : null}
    >
      <div className={styles.page}>
        <Rule />
        {killed ? <p className={styles.test} data-testid="experiments-killed">The kill switch is on. Running tests have been paused. Learners see the usual defaults.</p> : null}
        <section className={styles.summary} data-testid="experiment-summary">
          <div className={styles.tile}><b data-testid="count-running">{counts.running}</b><span>Running</span></div>
          <div className={styles.tile}><b data-testid="count-draft">{counts.draft}</b><span>Drafts</span></div>
          <div className={styles.tile}><b data-testid="count-paused">{counts.paused}</b><span>Paused</span></div>
          <div className={styles.tile}><b data-testid="count-finished">{counts.finished}</b><span>Finished</span></div>
        </section>
        {masterUser ? (
          <form className={styles.banner} action="/api/experiments" method="post" data-testid="kill-switch">
            <Hidden fields={{ action: 'kill', value: killed ? 'off' : 'on', next: base }} />
            <b>{killed ? 'Kill switch is on' : 'Kill switch'}</b>
            <p className={styles.quiet}>Stops every running test at once and sends learners back to the defaults.</p>
            <button className="btn ghost" type="submit">{killed ? 'Turn the kill switch off' : 'Turn the kill switch on'}</button>
          </form>
        ) : null}
        <div className={styles.groups}>
          {groups.map((group) => {
            const rows = items.filter((item) => item.status === group.key)
            if (!rows.length) return null
            return (
              <section key={group.key} data-testid={`experiment-group-${group.key}`}>
                <h2 style={{ margin: '0 0 10px', fontSize: 18 }}>{group.title}</h2>
                <div className={styles.cards}>
                  {rows.map((item) => {
                    const [label, tone] = STATUS_BADGE[item.status]
                    const slot = EXPERIMENT_SLOTS.find((row) => row.key === item.slot)
                    return (
                      <Link key={item.id} className={styles.card} href={`${base}/${item.id}`} data-testid="experiment-card" data-key={item.key} data-status={item.status}>
                        <div className={styles.meta}>
                          <span className={`badge ${tone}`}>{label}</span>
                          <span className="badge grey">{slot?.name || item.slot}</span>
                          <span className="badge grey">{item.allocation === 'auto' ? 'Auto' : 'Fixed split'}</span>
                        </div>
                        <h3>{item.name}</h3>
                        <p>{item.description || `${item.variants.length} versions · ${metricLabel(item.primaryMetric)}`}</p>
                        <p className={styles.quiet}>{item.variants.length} versions · {idOfPortal(item) ? 'One portal' : 'Every portal'}</p>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
        <section className="panel">
          <header><h2>Testable slots</h2></header>
          <div className="body">
            <div className={styles.slots} data-testid="slot-registry">
              {EXPERIMENT_SLOTS.map((slot) => (
                <div key={slot.key} className={styles.slot} data-testid="slot-row" data-slot={slot.key}>
                  <b>{slot.name}</b>
                  <span className={styles.quiet}>{slot.key} · {slot.kind === 'copy' ? 'Wording' : 'Layout'} · {slot.wired ? 'Live in the app' : 'Registered, not swapped yet'}</span>
                  <p className={styles.quiet} style={{ margin: '6px 0 0' }}>{slot.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </Frame>
  )
}

function idOfPortal(item: ExperimentDoc) {
  const value = item.portal
  if (value && typeof value === 'object' && 'id' in value) return Number((value as { id: number }).id)
  return typeof value === 'number' ? value : null
}

async function DetailPage({ ctx, master, base, id, suggest, error }: { ctx: Ctx | null; master: { payload: Payload; user: SessionUser; query: Query } | null; base: string; id: string; suggest: boolean; error?: string }) {
  const payload = ctx?.payload || master!.payload
  const user = ctx?.user || master!.user
  let results: ExperimentResults
  try {
    const experimentId = Number(id)
    if (!Number.isFinite(experimentId) || experimentId <= 0) {
      return <Frame ctx={ctx} master={master} title="Experiments" intro="" testId="experiment-missing"><p>That experiment was not found.</p></Frame>
    }
    results = await resultsFor(payload, user, experimentId)
  } catch (error) {
    return <Frame ctx={ctx} master={master} title="Experiments" intro="" testId="experiment-missing"><p>{error instanceof Error ? error.message : 'That experiment was not found.'}</p></Frame>
  }
  const { experiment, variants, verdict, totals } = results
  const [label, tone] = STATUS_BADGE[experiment.status]
  const masterUser = canEditExperiments(user)
  const audits = await experimentAudit(payload, experiment.key, user.role === 'master' ? null : undefined)
  const portals = masterUser ? await rows(payload, 'portals', undefined, { sort: 'name', limit: 40 }) : []
  const slot = EXPERIMENT_SLOTS.find((row) => row.key === experiment.slot)
  const testNote = variants.some((row) => row.exposures > 0) && (await payload.find({
    collection: 'experiment-events' as never,
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { and: [{ experiment: { equals: experiment.id } }, { subject: { like: 'test-data:' } }] },
  })).docs.length
  return (
    <Frame
      ctx={ctx}
      master={master}
      title={experiment.name}
      intro={experiment.description || slot?.description || ''}
      testId="experiment-detail"
      tools={<Link className="btn ghost" href={base}>All experiments</Link>}
    >
      <div className={styles.page}>
        <Rule />
        <div className={styles.meta}>
          <span className={`badge ${tone}`} data-testid="experiment-status">{label}</span>
          <span className="badge grey" data-testid="experiment-slot">{slot?.name || experiment.slot}</span>
          <span className="badge grey">{experiment.allocation === 'auto' ? 'Auto · Thompson sampling' : 'Fixed split'}</span>
          <span className="badge grey">{metricLabel(experiment.primaryMetric)}</span>
        </div>
        {testNote ? <p className={styles.test} data-testid="fake-test-data">These counts include labelled test data for a local or development database. They are not live learners.</p> : null}
        <section className={styles.summary}>
          <div className={styles.tile}><b data-testid="stat-exposures">{totals.exposures}</b><span>Exposures</span></div>
          <div className={styles.tile}><b data-testid="stat-conversions">{totals.conversions}</b><span>Conversions</span></div>
          <div className={styles.tile}><b data-testid="stat-assignments">{totals.assignments}</b><span>Sticky assignments</span></div>
          <div className={styles.tile}><b>{variants.length}</b><span>Versions</span></div>
        </section>
        <section className={styles.verdict} data-testid="experiment-verdict">
          <b>Plain reading</b>
          <p>{verdict.text}</p>
        </section>
        {masterUser ? (
          <div className="actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
            {experiment.status === 'draft' || experiment.status === 'paused' ? (
              <form action="/api/experiments" method="post"><Hidden fields={{ action: 'start', id: String(experiment.id), next: `${base}/${experiment.id}` }} /><button className="btn" type="submit" data-testid="experiment-start">Start</button></form>
            ) : null}
            {experiment.status === 'running' ? (
              <form action="/api/experiments" method="post"><Hidden fields={{ action: 'pause', id: String(experiment.id), next: `${base}/${experiment.id}` }} /><button className="btn ghost" type="submit" data-testid="experiment-pause">Pause</button></form>
            ) : null}
            {experiment.status === 'running' || experiment.status === 'paused' ? (
              <form action="/api/experiments" method="post"><Hidden fields={{ action: 'finish', id: String(experiment.id), next: `${base}/${experiment.id}` }} /><button className="btn ghost" type="submit" data-testid="experiment-finish">Finish</button></form>
            ) : null}
            <form action="/api/experiments" method="post">
              <Hidden fields={{ action: 'promote', id: String(experiment.id), variant: verdict.leaderKey || experiment.winnerKey || '', next: `${base}/${experiment.id}` }} />
              <button className="btn teal" type="submit" data-testid="experiment-promote" disabled={!verdict.leaderKey}>Make the winner the default</button>
            </form>
            <Link className="btn ghost" href={`${base}/${experiment.id}/edit`}>Edit</Link>
            <a className="btn ghost" href={`/api/experiments?action=export&id=${experiment.id}`} data-testid="experiment-csv">CSV</a>
            <form action="/api/experiments" method="post"><Hidden fields={{ action: 'test-data', id: String(experiment.id), next: `${base}/${experiment.id}` }} /><button className="btn ghost" type="submit" data-testid="experiment-test-data">Fill with labelled test numbers</button></form>
          </div>
        ) : null}
        <div className={styles.layout}>
          <section className="panel">
            <header><h2>Versions</h2></header>
            <div className="body" style={{ overflowX: 'auto' }}>
              <table className={styles.table} data-testid="variant-table">
                <thead>
                  <tr>
                    <th>Version</th>
                    <th>Copy</th>
                    <th>Approved</th>
                    <th>Exposures</th>
                    <th>Conversions</th>
                    <th>Rate</th>
                    <th>Chance of being best</th>
                    {masterUser ? <th></th> : null}
                  </tr>
                </thead>
                <tbody>
                  {variants.map((row) => (
                    <tr key={row.key} data-testid="variant-row" data-variant={row.key}>
                      <td><b>{row.letter}</b><div className={styles.quiet}>{row.key}</div></td>
                      <td data-testid="variant-copy">{variantCopy(row.payload, row.label)}</td>
                      <td>{row.approved ? 'Yes' : 'Needs approval'}</td>
                      <td data-testid="variant-exposures">{row.exposures}</td>
                      <td data-testid="variant-conversions">{row.conversions}</td>
                      <td>{pct(row.rate)}</td>
                      <td data-testid="variant-chance">{pct(row.chance)}</td>
                      {masterUser ? (
                        <td>
                          <form action="/api/experiments" method="post">
                            <Hidden fields={{ action: row.approved ? 'reject-variant' : 'approve-variant', id: String(experiment.id), variant: row.key, next: `${base}/${experiment.id}` }} />
                            <button className="btn ghost small" type="submit">{row.approved ? 'Hold back' : 'Approve'}</button>
                          </form>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div style={{ display: 'grid', gap: 18 }}>
            {masterUser && slot?.kind === 'copy' ? (
              <section className="panel" data-testid="ai-suggest-panel">
                <header><h2>Suggest built-in lines</h2></header>
                <div className="body">
                  <p className={styles.quiet}>Drafts 3 to 5 wording alternatives from the built-in set. The master desk does not call a model. You can also type a line on the experiment form. Each one needs your approval before it can run.</p>
                  <form action="/api/experiments" method="post">
                    <Hidden fields={{ action: 'suggest', id: String(experiment.id), next: `${base}/${experiment.id}?suggest=1` }} />
                    <label>Current line
                      <input name="current" defaultValue={variantCopy(experiment.variants[0]?.payload, experiment.variants[0]?.label)} />
                    </label>
                    <button className="btn" type="submit" data-testid="experiment-suggest">Suggest built-in lines</button>
                  </form>
                  {suggest && !error ? <p className={styles.quiet} data-testid="ai-suggest-done">Drafts were added below. Approve the ones you want before you start.</p> : null}
                </div>
              </section>
            ) : null}
            <section className="panel">
              <header><h2>Guardrail</h2></header>
              <div className="body">
                <p className={styles.quiet}>{experiment.guardrailNote || EXPERIMENT_RULE}</p>
                <p className={styles.quiet}>Slot <code>{experiment.slot}</code>{slot?.wired ? '' : ' · registered only; the app still uses the default framing.'}</p>
              </div>
            </section>
          </div>
        </div>
        <section className="panel">
          <header>
            <div>
              <h2>Who changed what</h2>
              <LocalZoneNote />
            </div>
          </header>
          <div className="body">
            {audits.length ? (
              <table className={styles.table} data-testid="experiment-audit">
                <thead><tr><th>When</th><th>What</th><th>Who</th></tr></thead>
                <tbody>
                  {audits.map((row) => (
                    <tr key={row.id}>
                      <td style={{ whiteSpace: 'nowrap' }}><LocalWhen at={atIso(row.at)} /></td>
                      <td data-testid="audit-what">{experimentAuditLine(String(row.event || ''), (row.detail || {}) as Record<string, unknown>, experiment)}</td>
                      <td>{row.actorRole || 'desk'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className={styles.quiet}>Nothing written to the audit log for this experiment yet.</p>}
          </div>
        </section>
        {masterUser && portals.length ? <p className={styles.quiet}>Scope: {idOfPortal(experiment) ? portals.find((row) => row.id === idOfPortal(experiment)) ? str((portals.find((row) => row.id === idOfPortal(experiment)) as { name?: string }).name) : 'One portal' : 'Every portal'}.</p> : null}
      </div>
    </Frame>
  )
}

async function EditPage({ ctx, master, base, id, fromInsight }: { ctx: Ctx | null; master: { payload: Payload; user: SessionUser; query: Query } | null; base: string; id?: number; fromInsight?: Query }) {
  const payload = ctx?.payload || master!.payload
  const user = ctx?.user || master!.user
  if (!canEditExperiments(user)) {
    return <Frame ctx={ctx} master={master} title="Experiments" intro="" testId="experiment-edit-denied"><p>Only the master can create an experiment.</p></Frame>
  }
  const current = id ? await loadExperiment(payload, id) : null
  if (id && !current) return <Frame ctx={ctx} master={master} title="Experiments" intro="" testId="experiment-missing"><p>That experiment was not found.</p></Frame>
  const portals = await rows(payload, 'portals', undefined, { sort: 'name', limit: 40 })
  const query = queryOf(ctx, master)
  const insightSlotRaw = queryText(fromInsight || {}, 'slot')
  const insightSlot = insightSlotRaw && EXPERIMENT_SLOTS.some((slot) => slot.key === insightSlotRaw) ? insightSlotRaw : ''
  const insightNote = fromInsight?.from === 'insight' ? `From Insights${fromInsight.route ? ` · ${fromInsight.route}` : ''}${fromInsight.reason ? ` · ${fromInsight.reason}` : ''}` : ''
  const variantText = queryText(query, 'variants') || (current?.variants || []).map((row) => `${row.key} | ${row.label}`).join('\n')
  return (
    <Frame ctx={ctx} master={master} title={current ? `Edit ${current.name}` : 'New experiment'} intro="Stay on a listed slot. Versions are wording or framing only." testId="experiment-edit">
      <ExperimentForm
        draft={{
          action: current ? 'update' : 'create',
          id: current ? String(current.id) : '',
          next: current ? `${base}/${current.id}` : `${base}/new`,
          key: queryText(query, 'key') || current?.key || '',
          name: queryText(query, 'name') || current?.name || (insightNote ? 'From Insights' : ''),
          description: queryText(query, 'description') || current?.description || insightNote,
          slot: queryText(query, 'slot') || current?.slot || insightSlot || 'feed-cta-label',
          slotOverride: queryText(query, 'slotOverride') || '',
          portal: queryText(query, 'portal') || (current ? String(idOfPortal(current) || '') : ''),
          allocation: queryText(query, 'allocation') || current?.allocation || 'fixed',
          primaryMetric: queryText(query, 'primaryMetric') || current?.primaryMetric || 'clip_cta_tap',
          secondary: queryText(query, 'secondary') || (current?.secondaryMetrics || []).join(', '),
          variants: variantText || 'ready | Ready for more?\nthree-min | Watch the 3-minute version',
          existing: Boolean(current),
          cancelHref: current ? `${base}/${current.id}` : base,
          rule: EXPERIMENT_RULE,
          slots: EXPERIMENT_SLOTS.map((slot) => ({ value: slot.key, label: `${slot.name} — ${slot.wired ? 'live' : 'registered only'}` })),
          portals: portals.map((portal) => ({ value: String(portal.id), label: str(portal.name) })),
          metrics: PRIMARY_METRICS.map((metric) => ({ value: metric.key, label: metric.label })),
        }}
      />
    </Frame>
  )
}
