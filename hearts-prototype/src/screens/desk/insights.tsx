import Link from 'next/link'
import type { Payload } from 'payload'
import { Hidden } from '@/components/app/shell'
import { routeWords } from '@/lib/insight-events'
import { pct } from '@/lib/insight-funnel'
import type { SessionUser } from '@/server/context'
import { canViewInsights, insightsDesk } from '@/server/insights'
import { canEditExperiments } from '@/server/experiments'
import type { Ctx } from '../common'
import { AdminFrame } from './overview'
import { DeskFrame, masterNav } from './shell'
import styles from './desk-extra.module.css'

type Query = Record<string, string | undefined>

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
  if (ctx) return <AdminFrame ctx={ctx} active="insights" title={title} intro={intro} testId={testId} tools={tools}>{children}</AdminFrame>
  const desk = master!
  return (
    <DeskFrame payload={desk.payload} user={desk.user} title={title} intro={intro} active="insights" nav={masterNav()} brand="HEARTS" subBrand="Master desk" brandHref="/master" query={desk.query} testId={testId} tools={tools}>
      {children}
    </DeskFrame>
  )
}

export async function InsightPages({ ctx, master }: { ctx?: Ctx | null; master?: { payload: Payload; user: SessionUser; query: Query } | null }) {
  const payload = ctx?.payload || master!.payload
  const user = ctx?.user || master!.user
  const query = (ctx?.query || master?.query || {}) as Query
  const base = ctx ? `${ctx.base}/admin/insights` : '/master/insights'
  if (!canViewInsights(user)) {
    return <Frame ctx={ctx || null} master={master || null} title="Insights" intro="" testId="insights-denied"><p>Insights are for the master desk and portal admins.</p></Frame>
  }
  const desk = await insightsDesk(payload, user, { route: query.route, session: query.session })
  const tab = query.tab || 'heatmap'
  const canMake = canEditExperiments(user)
  const makeExperiment = (reason: string, testId: string, slot = 'feed-cta-label') => canMake ? (
    <form action="/api/experiments" method="post">
      <Hidden fields={{ action: 'from-label', slot, reason, next: '/master/experiments' }} />
      <button className="btn" type="submit" data-testid={testId}>Make this an experiment</button>
    </form>
  ) : null
  return (
    <Frame
      ctx={ctx || null}
      master={master || null}
      title="Insights"
      intro="Our own look at taps, drop-off and coming back. Nothing typed, no answers, all on our own Postgres."
      testId="insights-desk"
      tools={
        <form action="/api/insights" method="post">
          <Hidden fields={{ action: 'test-data', next: base }} />
          <button className="btn ghost" type="submit" data-testid="insights-test-data">Fill with labelled test numbers</button>
        </form>
      }
    >
      <div className={styles.page}>
        <p className={styles.quiet}>One in {Math.round(100 / Math.max(1, desk.sampleRate))} sessions is sampled for tap maps and replays. Angry taps and funnels are always kept.</p>
        {desk.testData ? <p className={styles.testBadge} data-testid="test-numbers">Test numbers</p> : null}
        <section className={styles.summary}>
          <div className={styles.tile}><b data-testid="insight-routes">{desk.routes.length}</b><span>Routes with taps</span></div>
          <div className={styles.tile}><b data-testid="insight-angry">{desk.angry.length}</b><span>Angry taps</span></div>
          <div className={styles.tile}><b>{desk.funnel.started}</b><span>Opened the questions</span></div>
          <div className={styles.tile}><b>{pct(desk.retention.points[0]?.rate || 0)}</b><span>Back the next day</span></div>
        </section>
        <div className={styles.tabs}>
          {[['heatmap', 'Heatmap'], ['funnel', 'Funnel'], ['angry', 'Angry taps'], ['retention', 'Retention']].map(([key, label]) => (
            <Link key={key} className={`btn ${tab === key ? '' : 'ghost'} small`} href={`${base}?tab=${key}${desk.heatmap.route ? `&route=${encodeURIComponent(desk.heatmap.route)}` : ''}`} data-testid={`insights-tab-${key}`}>{label}</Link>
          ))}
        </div>
        {tab === 'heatmap' ? (
          <div className={styles.layout} data-testid="insights-heatmap">
            <section className="panel">
              <header><h2>Tap map</h2></header>
              <div className="body">
                <form action={base} method="get">
                  <Hidden fields={{ tab: 'heatmap' }} />
                  <label>Route
                    <select name="route" defaultValue={desk.heatmap.route} data-testid="insights-route">
                      {desk.routes.map((row) => <option key={row.route} value={row.route}>{row.route} · {row.taps} taps</option>)}
                    </select>
                  </label>
                  <button className="btn ghost small" type="submit">Show</button>
                </form>
                <p className={styles.quiet}>Includes taps on things that are not buttons. Gold dots are where people tapped.</p>
                <div className={styles.heat} data-testid="heatmap-overlay">
                  {desk.heatmap.cells.map((cell) => (
                    <span
                      key={`${cell.x}-${cell.y}`}
                      className={styles.dot}
                      style={{
                        left: `${((cell.x + 0.5) / 16) * 100}%`,
                        top: `${((cell.y + 0.5) / 28) * 100}%`,
                        opacity: 0.35 + (cell.n / desk.heatmap.max) * 0.65,
                        transform: `translate(-50%, -50%) scale(${0.85 + (cell.n / desk.heatmap.max) * 0.7})`,
                      }}
                    />
                  ))}
                </div>
                {makeExperiment(`heatmap on ${desk.heatmap.route}`, 'make-experiment')}
                <div className={styles.scrollBlock} data-testid="insights-scroll">
                  <h3>How far people scrolled</h3>
                  {desk.scroll.length ? desk.scroll.map((row) => (
                    <p key={row.route} className={styles.quiet}>{routeWords(row.route)} · {Math.round(row.max)}%</p>
                  )) : <p className={styles.quiet}>No scroll depth yet.</p>}
                </div>
              </div>
            </section>
            <section className="panel">
              <header><h2>Replay</h2></header>
              <div className="body">
                {desk.replay ? (
                  <ol data-testid="insight-replay" style={{ paddingLeft: 18, margin: 0 }}>
                    {desk.replay.events.map((event, index) => (
                      <li key={`${event.at}-${index}`} className={styles.quiet}>
                        {event.line || `${event.kind.replace(/_/g, ' ')} · ${routeWords(event.route)}`}
                      </li>
                    ))}
                  </ol>
                ) : <p className={styles.quiet}>No session replay yet.</p>}
              </div>
            </section>
          </div>
        ) : null}
        {tab === 'funnel' ? (
          <section className="panel" data-testid="insights-funnel">
            <header><h2>Drop-off</h2></header>
            <div className="body">
              <div className={styles.funnel}>
                {desk.funnel.steps.map((step) => (
                  <div key={step.key} className={styles.bar} data-testid="funnel-step" data-step={step.key}>
                    <p className={styles.barLabel}>{step.label} · {step.sessions} sessions</p>
                    <p className={styles.quiet}>{pct(step.fromStart)} of those who began · {pct(step.dropOff)} left here</p>
                    <span className={styles.meter} style={{ width: `${Math.max(6, Math.round(step.fromStart * 100))}%` }} />
                  </div>
                ))}
              </div>
              <p className={styles.quiet} style={{ marginTop: 12 }}>Clip watch-through median {Math.round(desk.watch.medianPct)}%. {desk.watch.swipeAway} swipes away from a clip.</p>
              {makeExperiment('funnel drop-off', 'make-experiment-funnel')}
            </div>
          </section>
        ) : null}
        {tab === 'angry' ? (
          <section className="panel" data-testid="insights-angry">
            <header><h2>Angry taps</h2></header>
            <div className="body">
              {desk.angry.length ? (
                <table className={styles.table}>
                  <thead><tr><th>Screen</th><th>Where</th><th>When</th><th /></tr></thead>
                  <tbody>
                    {desk.angry.map((row) => (
                      <tr key={row.id} data-testid="angry-row">
                        <td>{routeWords(row.route)}</td>
                        <td>{row.place}</td>
                        <td>{row.at ? new Date(row.at).toLocaleString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</td>
                        <td><Link href={`${base}?tab=heatmap&route=${encodeURIComponent(row.route)}`}>Open route</Link> · {makeExperiment('angry taps', `make-experiment-angry-${row.id}`)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className={styles.quiet}>No angry taps yet. That is a good day.</p>}
            </div>
          </section>
        ) : null}
        {tab === 'retention' ? (
          <section className="panel" data-testid="insights-retention">
            <header><h2>Came back</h2></header>
            <div className="body">
              <p className={styles.quiet}>{desk.retention.cohort} people in the cohort.</p>
              <div className={styles.funnel}>
                {desk.retention.points.map((point) => (
                  <div key={point.day} className={styles.bar} data-testid="retention-day" data-day={point.day}>
                    <p className={styles.barLabel}>Day {point.day} · {point.returned} came back</p>
                    <p className={styles.quiet}>{pct(point.rate)}</p>
                    <span className={styles.meter} style={{ width: `${Math.max(6, Math.round(point.rate * 100))}%` }} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </Frame>
  )
}
