import Link from 'next/link'
import { ExampleInUse } from '@/components/app/care'
import type { Payload } from 'payload'
import { Hidden } from '@/components/app/shell'
import { routeWords } from '@/lib/insight-events'
import { pct } from '@/lib/insight-funnel'
import type { SessionUser } from '@/server/context'
import { isInsightKey } from '@/lib/insight-stories'
import { canViewInsights, insightsDesk, type PresentedStory } from '@/server/insights'
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
    <DeskFrame payload={desk.payload} user={desk.user} title={title} intro={intro} active="insights" nav={masterNav()} brand="HEARTS" subBrand="Master desk" brandHref="/master" query={desk.query} testId={testId} tools={tools} showOnPhone>
      {children}
    </DeskFrame>
  )
}

function filterQuery(query: Query) {
  const params = new URLSearchParams()
  if (query.portal) params.set('portal', query.portal)
  if (query.from) params.set('from', query.from)
  if (query.to) params.set('to', query.to)
  const text = params.toString()
  return text ? `?${text}` : ''
}

export async function InsightPages({ ctx, master, path = [] }: { ctx?: Ctx | null; master?: { payload: Payload; user: SessionUser; query: Query } | null; path?: string[] }) {
  const payload = ctx?.payload || master!.payload
  const user = ctx?.user || master!.user
  const query = (ctx?.query || master?.query || {}) as Query
  const base = ctx ? `${ctx.base}/admin/insights` : '/master/insights'
  if (!canViewInsights(user)) {
    return <Frame ctx={ctx || null} master={master || null} title="Insights" intro="" testId="insights-denied"><p>Insights are for the master desk and portal admins.</p></Frame>
  }
  const [head] = path
  if (head && isInsightKey(head)) {
    return <InsightDrill ctx={ctx || null} master={master || null} base={base} storyKey={head} />
  }
  if (head) {
    return <Frame ctx={ctx || null} master={master || null} title="Insights" intro="" testId="insight-missing"><p>That insight was not found.</p></Frame>
  }
  const desk = await insightsDesk(payload, user, { route: query.route, session: query.session, portal: query.portal, from: query.from, to: query.to })
  const portals = user.role === 'master'
    ? (await payload.find({ collection: 'portals', overrideAccess: true, depth: 0, limit: 40, sort: 'name' })).docs as { id: number; name?: string }[]
    : []
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
      intro="Taps, where people leave, and who comes back. Typed answers are not stored here."
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
        {desk.testData ? <p className={styles.testBadge} data-testid="test-numbers">Sample data — labelled test fill, not live visits</p> : null}
        <Filters base={base} query={query} portals={portals} />
        <div className={styles.cards} data-testid="insight-cards">
          {desk.stories.map((story) => (
            <Link key={story.key} className={styles.card} href={`${base}/${story.key}${filterQuery(query)}`} data-testid="insight-card" data-key={story.key} data-thin={story.thin ? 'yes' : 'no'}>
              <h3>{story.title}</h3>
              <p>{story.line}</p>
              <span className={styles.more}>{story.actionLabel}</span>
            </Link>
          ))}
        </div>
        <section className={styles.summary}>
          <div className={styles.tile}><b data-testid="insight-routes">{desk.routes.length}</b><span>Routes with taps</span></div>
          <div className={styles.tile}><b data-testid="insight-angry">{desk.angry.length}</b><span>Angry taps</span></div>
          <div className={styles.tile}><b>{desk.funnel.started}</b><span>Opened the questions</span></div>
          <div className={styles.tile}><b>{pct(desk.retention.points[0]?.rate || 0)}</b><span>Back the next day{desk.testData ? ' · sample data' : ''}</span></div>
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
                  )) : <ExampleInUse desk title="The home feed" action={{ href: base.startsWith('/master') ? '/master' : base.replace(/\/admin\/insights.*/, ''), label: 'Open the app' }}><p>People reached about halfway down the page.</p></ExampleInUse>}
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
                ) : <ExampleInUse desk title="One visit" action={{ href: base.startsWith('/master') ? '/master' : base.replace(/\/admin\/insights.*/, ''), label: 'Open the app' }}><p>Opened the feed, watched a clip, left on the question.</p></ExampleInUse>}
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
              ) : <ExampleInUse desk title="A calm day" action={{ href: base.startsWith('/master') ? '/master/insights' : `${base}?tab=angry`, label: 'Stay with this view' }}><p>No repeated taps on a stuck control. That is a good day.</p></ExampleInUse>}
            </div>
          </section>
        ) : null}
        {tab === 'retention' ? (
          <section className="panel" data-testid="insights-retention">
            <header><h2>Came back</h2></header>
            <div className="body">
              <p className={styles.quiet}>{desk.retention.cohort} returning visits sent a days-since-last-visit bucket. The last-visit date stays on the phone.{desk.testData ? ' These figures are sample data.' : ''}</p>
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

function Filters({ base, query, portals }: { base: string; query: Query; portals: { id: number; name?: string }[] }) {
  return (
    <form className={styles.filters} action={base} method="get" data-testid="insight-filters">
      {portals.length ? (
        <label>Portal
          <select name="portal" defaultValue={query.portal || ''} data-testid="insight-filter-portal">
            <option value="">Every portal</option>
            {portals.map((portal) => <option key={portal.id} value={portal.id}>{portal.name}</option>)}
          </select>
        </label>
      ) : null}
      <label>From
        <input type="date" name="from" defaultValue={query.from || ''} data-testid="insight-filter-from" />
      </label>
      <label>Until
        <input type="date" name="to" defaultValue={query.to || ''} data-testid="insight-filter-to" />
      </label>
      <button className="btn ghost small" type="submit" data-testid="insight-filter-apply">Show</button>
    </form>
  )
}

const EXAMPLE: Record<string, { title: string; body: string }> = {
  leaving: { title: 'Before a course', body: 'Twelve people opened the questions. Four reached a course. The rest left on the feed.' },
  returning: { title: 'The next day', body: 'About half of the visits came back the next day. Tuesday was the fullest.' },
  stuck: { title: 'The same spot', body: 'The lower middle of the feed was tapped again and again, then the visit ended.' },
  talks: { title: 'A short clip', body: 'People watched a short clip to about 70%, then a few opened the whole talk.' },
}

async function InsightDrill({ ctx, master, base, storyKey }: { ctx: Ctx | null; master: { payload: Payload; user: SessionUser; query: Query } | null; base: string; storyKey: string }) {
  const payload = ctx?.payload || master!.payload
  const user = ctx?.user || master!.user
  const query = (ctx?.query || master?.query || {}) as Query
  const desk = await insightsDesk(payload, user, { portal: query.portal, from: query.from, to: query.to })
  const story = desk.stories.find((row) => row.key === storyKey)
  if (!story) {
    return <Frame ctx={ctx} master={master} title="Insights" intro="" testId="insight-missing"><p>That insight was not found.</p></Frame>
  }
  const portals = user.role === 'master'
    ? (await payload.find({ collection: 'portals', overrideAccess: true, depth: 0, limit: 40, sort: 'name' })).docs as { id: number; name?: string }[]
    : []
  const back = `${base}/${story.key}${filterQuery(query)}`
  const example = EXAMPLE[story.key]
  const max = Math.max(1, ...story.trend.map((row) => row.n))
  return (
    <Frame ctx={ctx} master={master} title={story.title} intro={story.line} testId="insight-drill" tools={<Link className="btn ghost" href={`${base}${filterQuery(query)}`}>All insights</Link>}>
      <div className={styles.page} data-key={story.key} data-thin={story.thin ? 'yes' : 'no'}>
        <Filters base={`${base}/${story.key}`} query={query} portals={portals} />
        <p className={styles.quiet} data-testid="insight-privacy">Names and typed answers are not stored. A visit is only retold when the screen itself is not a private answer.</p>
        {desk.testData ? <p className={styles.testBadge} data-testid="test-numbers">Sample data — labelled test fill, not live visits</p> : null}
        {story.thin ? (
          <ExampleInUse desk testId="insight-example" title={example.title} action={{ href: '#insight-action', label: story.actionLabel }}>
            <p>{example.body}</p>
          </ExampleInUse>
        ) : null}
        <section className="panel" data-testid="insight-numbers">
          <header><h2>The numbers</h2></header>
          <div className="body">
            {story.thin ? <p className={styles.quiet}>These counts are empty for this filter. The example above is not a real record.</p> : null}
            <div className={styles.summary}>
              {story.numbers.map((row) => (
                <div key={row.label} className={styles.tile}><b>{row.value}</b><span>{row.label}</span></div>
              ))}
            </div>
          </div>
        </section>
        <section className="panel" data-testid="insight-trend">
          <header><h2>Over time</h2></header>
          <div className="body">
            {story.trend.length ? (
              <div className={styles.trend}>
                {story.trend.map((row) => (
                  <div key={row.day} className={styles.trendCol} data-testid="insight-trend-bar">
                    <span className={styles.trendBar} style={{ height: `${Math.max(8, Math.round((row.n / max) * 120))}px` }} />
                    <b>{row.n}</b>
                    <span>{row.label}</span>
                  </div>
                ))}
              </div>
            ) : <p className={styles.quiet}>No days in this range yet.</p>}
          </div>
        </section>
        <section className="panel" data-testid="insight-drivers">
          <header><h2>What is driving it</h2></header>
          <div className="body">
            {story.driverLines.length ? (
              <ul className={styles.driverList}>
                {story.driverLines.map((row) => (
                  <li key={`${row.kind}-${row.label}`}><b>{row.label}</b> <span className={styles.quiet}>{row.kind} · {row.n}</span></li>
                ))}
              </ul>
            ) : <p className={styles.quiet}>No portal, course or talk stands out in this range.</p>}
          </div>
        </section>
        <section className="panel" data-testid="insight-moments">
          <header><h2>A visit</h2></header>
          <div className="body">
            {story.moments.length ? (
              <ol>
                {story.moments.map((moment, index) => <li key={index}>{moment.line}</li>)}
              </ol>
            ) : <p className={styles.quiet}>No visit was kept in enough detail to retell.</p>}
          </div>
        </section>
        <div id="insight-action" data-testid="insight-action">
          <StoryAction story={story} back={back} experiments={base.replace(/\/insights$/, '/experiments')} />
        </div>
      </div>
    </Frame>
  )
}

function StoryAction({ story, back, experiments }: { story: PresentedStory; back: string; experiments: string }) {
  if (story.action === 'talk') {
    return <Link className="btn" href={story.talkHref} data-testid="insight-open-talk">{story.actionLabel}</Link>
  }
  if (story.action === 'experiment') {
    return (
      <form action="/api/experiments" method="post">
        <Hidden fields={{ action: 'preset', preset: story.preset || 'clip-button', next: experiments, portal: '' }} />
        <button className="btn" type="submit" data-testid="insight-start-experiment">{story.actionLabel}</button>
      </form>
    )
  }
  if (story.action === 'plan') {
    return (
      <form action="/api/insights" method="post">
        <Hidden fields={{ action: 'make-plan', next: back, portal: story.planPortalId ? String(story.planPortalId) : '' }} />
        <button className="btn" type="submit" data-testid="insight-make-plan">{story.actionLabel}</button>
      </form>
    )
  }
  return (
    <form action="/api/insights" method="post">
      <Hidden fields={{ action: 'message-teacher', next: back, portal: story.planPortalId ? String(story.planPortalId) : '' }} />
      <button className="btn" type="submit" data-testid="insight-message-teacher">{story.actionLabel}</button>
    </form>
  )
}
