import Link from 'next/link'
import { notFound } from 'next/navigation'
import { combineServes, compassDate, kindLabel, monthShort, plainWhy, teachDoors, teachLine } from '@/lib/compass-feed'
import { tidyTalkTitle } from '@/lib/talk-title'
import { SCALE_KEYS, type ScaleKey } from '@/lib/heart'
import { staffLearner, staffPortal } from '@/server/compass'
import { type Ctx } from '../common'
import { AdminFrame } from './overview'
import { Hidden } from '@/components/app/shell'

function signed(value: number | null) {
  if (value == null) return '—'
  return value > 0 ? `+${value}` : String(value)
}

function Mark({ rung }: { rung: number }) {
  const left = ((Math.min(10, Math.max(-10, rung)) + 10) / 20) * 100
  return (
    <span className="rung-track" data-rung={rung}>
      <i className="rung-zero" />
      <b className="rung-mark" style={{ left: `${left}%` }} />
    </span>
  )
}

function personaSummary(rows: { at: string; title: string }[]) {
  const changes = rows.filter((row, index) => index === 0 || row.title !== rows[index - 1].title)
  if (!changes.length) return ''
  if (changes.length === 1) return `${changes[0].title} since ${monthName(changes[0].at)}`
  return changes.map((row, index) => (index === 0 ? `${row.title} since ${monthName(row.at)}` : `${row.title} from ${monthName(row.at)}`)).join(', then ')
}

function monthName(at: number | string) {
  return monthShort(at)
}

function Spark({ points }: { points: { at: number | string; rung: number }[] }) {
  const width = 360
  const height = 128
  if (!points.length) return <p className="hint">No looks yet.</p>
  const times = points.map((point) => new Date(point.at).getTime())
  const minT = times[0]
  const maxT = times[times.length - 1]
  const x = (at: number) => (points.length === 1 ? width / 2 : 28 + ((at - minT) / (maxT - minT || 1)) * (width - 56))
  const y = (rung: number) => 16 + ((10 - Math.min(10, Math.max(-10, rung))) / 20) * (height - 40)
  const d = times.map((at, index) => `${index ? 'L' : 'M'}${x(at).toFixed(1)},${y(points[index].rung).toFixed(1)}`).join(' ')
  const delta = points[points.length - 1].rung - points[0].rung
  const tone = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  const latest = points[points.length - 1].rung
  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Month by month">
      <line x1="28" x2={width - 20} y1={y(0)} y2={y(0)} className="spark-zero" />
      <path d={d} className={tone} />
      {points.map((point, index) => (
        <g key={times[index]}>
          <circle cx={x(times[index])} cy={y(point.rung)} r="3.4" />
          <text x={x(times[index])} y={height - 6} textAnchor="middle">{monthName(point.at)}</text>
        </g>
      ))}
      <text x={x(times[times.length - 1])} y={y(latest) - 8} textAnchor="middle">{latest > 0 ? `+${latest}` : String(latest)}</text>
    </svg>
  )
}

/** Portal summary, the anonymised cohort, and the mix the shelf uses. */
export async function PortalCompassScreen(ctx: Ctx) {
  const summary = await staffPortal(ctx.payload, ctx.user, ctx.portal.id)
  if (!summary) notFound()
  const peak = Math.max(1, ...summary.personas.map((row) => row.count))
  return (
    <AdminFrame ctx={ctx} active="compass" title="Compass" intro="Scores run from -10 to +10. Learners see a gentle Focusing on line, never a label and never a number." testId="compass-portal">
      <section className="panel" data-testid="cohort" style={{ marginBottom: 18 }}>
        <header><h2>The circle, with no names</h2><span className="hint">{summary.learners.length} learners</span></header>
        <div className="body cohort">
          <div data-testid="cohort-personas">
            {summary.personas.map((row) => (
              <div key={row.key} className="cohort-row" data-testid="cohort-persona">
                <span>{row.title}</span>
                <span className="bar"><i style={{ width: `${Math.round((row.count / peak) * 100)}%` }} /></span>
                <b>{row.count}</b>
              </div>
            ))}
            {!summary.personas.length ? <p>No monthly looks in this portal yet.</p> : null}
          </div>
          <div data-testid="cohort-weak">
            <p className="eyebrow">Teach next</p>
            {summary.weakest.map((row, index) => (
              <p key={row.scale} data-testid="weak-scale">{teachLine(row.scale, index, teachDoors(summary.weakest.map((item) => item.scale))[index])} Latest score {signed(row.mean)}.</p>
            ))}
            {!summary.weakest.length ? <p>Once a few people have sat with the compass, the quieter scales will show here.</p> : null}
          </div>
        </div>
      </section>
      <section className="panel" style={{ marginBottom: 18 }} data-testid="mix-panel">
        <header><h2>How the shelf is mixed</h2></header>
        <form className="body mix-form" action="/api/compass" method="post" data-testid="mix-form">
          <Hidden fields={{ action: 'mix', next: `${ctx.base}/admin/compass`, portal: String(ctx.portal.slug || '') }} />
          <label>Quieter scales <input name="deficit" type="number" min={0} max={100} defaultValue={summary.mix.deficit} /></label>
          <label>Steady scales <input name="strength" type="number" min={0} max={100} defaultValue={summary.mix.strength} /></label>
          <label>A new door <input name="discovery" type="number" min={0} max={100} defaultValue={summary.mix.discovery} /></label>
          <button className="btn gold" type="submit">Save the mix</button>
          <p className="hint">Shares are scaled to 100. The usual mix is 60, 25 and 15.</p>
        </form>
      </section>
      <section className="panel" style={{ marginBottom: 18 }}>
        <header><h2>The chapter</h2></header>
        <div className="table-wrap">
          {summary.scales.some((scale) => scale.helpedBy.length) ? (
            <table className="data">
              <thead><tr><th>Scale</th><th className="num">Earlier</th><th className="num">Latest</th><th>Talks beside an upward move</th><th className="num">People</th></tr></thead>
              <tbody>
                {summary.scales.map((scale) => (
                  <tr key={scale.scale} data-testid="portal-scale" data-scale={scale.scale}>
                    <td><b>{scale.name}</b></td>
                    <td className="num" data-testid="mean-then">{signed(scale.meanThen)}</td>
                    <td className="num" data-testid="mean-now">{signed(scale.meanNow)}</td>
                    <td data-testid="helped-by">{scale.helpedBy.length ? scale.helpedBy.map((item) => `${tidyTalkTitle(item.title)} (${item.lifts})`).join(', ') : '—'}</td>
                    <td className="num">{scale.learners}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <>
              <table className="data">
                <thead><tr><th>Scale</th><th className="num">Earlier</th><th className="num">Latest</th><th className="num">People</th></tr></thead>
                <tbody>
                  {summary.scales.map((scale) => (
                    <tr key={scale.scale} data-testid="portal-scale" data-scale={scale.scale}>
                      <td><b>{scale.name}</b></td>
                      <td className="num" data-testid="mean-then">{signed(scale.meanThen)}</td>
                      <td className="num" data-testid="mean-now">{signed(scale.meanNow)}</td>
                      <td className="num">{scale.learners}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="hint" data-testid="helped-empty">No tagged talk sat in the month before a rise.</p>
            </>
          )}
        </div>
      </section>
      <section className="panel">
        <header><h2>Each learner</h2></header>
        <div className="body" style={{ display: 'grid', gap: 8 }}>
          {summary.learners.map((learner) => (
            <Link key={learner.id} href={`${ctx.base}/admin/compass/${learner.id}`} data-testid="compass-learner">{learner.name} · {learner.attempts} {learner.attempts === 1 ? 'look' : 'looks'}</Link>
          ))}
          {!summary.learners.length ? <p>No learners in this portal yet.</p> : null}
        </div>
      </section>
    </AdminFrame>
  )
}

/** One learner over the months: persona, scales, life, and why a talk was put forward. */
export async function StaffLearnerCompass(ctx: Ctx, learnerId: number) {
  const learner = await ctx.payload.findByID({ collection: 'users', id: learnerId, overrideAccess: true, depth: 0 }).catch(() => null)
  if (!learner || learner.role !== 'learner') notFound()
  const detail = await staffLearner(ctx.payload, ctx.user, learner as never, ctx.portal.id)
  if (!detail) notFound()
  const columns = detail.attempts
  return (
    <AdminFrame ctx={ctx} active="compass" title={detail.name} intro="Scores run from -10 to +10. Opening this page is written to the audit log." testId="compass-learner">
      <p><Link href={`${ctx.base}/admin/compass`}>All learners</Link></p>
      {detail.guide.length ? <p data-testid="compass-guide">Rough guide: {detail.guide.join(', ')}. This name stays on this desk.</p> : null}
      <section className="panel" style={{ marginBottom: 18 }} data-testid="persona-timeline">
        <header><h2>Persona over time</h2></header>
        <div className="body">
          {detail.personaTimeline.length ? <p className="persona-line">{personaSummary(detail.personaTimeline)}</p> : <p>No look yet.</p>}
          <div className="persona-chips">
            {detail.personaTimeline.map((row, index) => {
              const changed = index === 0 || row.title !== detail.personaTimeline[index - 1].title
              return <span key={row.at} className={`chip${changed ? ' on' : ''}`} data-testid="persona-chip">{monthName(row.at)}{changed && index > 0 ? ` ${row.title}` : ''}</span>
            })}
          </div>
        </div>
      </section>
      <section className="panel" style={{ marginBottom: 18 }}>
        <header>
          <h2>Each scale, month by month</h2>
          <p className="spark-legend"><span><i className="up" /> Rising</span><span><i className="down" /> Quieter</span></p>
        </header>
        <div className="body sparks" data-testid="scale-sparks">
          {detail.series.map((row) => {
            const last = row.points[row.points.length - 1]
            const first = row.points[0]
            const tone = last && first && last.rung < first.rung ? 'down' : 'up'
            return (
              <article key={row.scale} className="spark-card" data-testid="spark" data-scale={row.scale}>
                <header><b>{row.name}</b>{last ? <span className={`latest ${tone}`}>{signed(last.rung)}</span> : null}</header>
                <Spark points={row.points} />
              </article>
            )
          })}
        </div>
      </section>
      <section className="panel" style={{ marginBottom: 18 }}>
        <header><h2>Over time</h2></header>
        <div className="table-wrap">
          <table className="data" data-testid="scale-chart">
            <thead>
              <tr>
                <th>Scale</th>
                {columns.map((attempt) => <th key={attempt.at} className="num">{compassDate(attempt.at)}<div className="hint">{attempt.bank === 'month' ? 'Month' : 'Opening'}</div></th>)}
              </tr>
            </thead>
            <tbody>
              {SCALE_KEYS.map((scale) => {
                const name = columns.flatMap((attempt) => attempt.points).find((point) => point.scale === scale)?.name || scale
                const any = columns.some((attempt) => attempt.points.some((point) => point.scale === scale))
                if (!any) return null
                return (
                  <tr key={scale} data-testid="scale-row" data-scale={scale as ScaleKey}>
                    <td><b>{name}</b></td>
                    {columns.map((attempt) => {
                      const point = attempt.points.find((row) => row.scale === scale)
                      return (
                        <td key={attempt.at} className="num">
                          {point ? <><span data-rung={point.rung}>{signed(point.rung)}</span><Mark rung={point.rung} /></> : '—'}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel" style={{ marginBottom: 18 }} data-testid="life-timeline">
        <header><h2>What was going on</h2></header>
        <ol className="body timeline">
          {detail.life.map((row) => (
            <li key={row.at}><time>{compassDate(row.at)}</time> {row.label}{row.note ? <span className="hint"> — {row.note}</span> : null}</li>
          ))}
          {!detail.life.length ? <li>No life check-in yet.</li> : null}
        </ol>
      </section>
      <section className="panel" style={{ marginBottom: 18 }} data-testid="why-now">
        <header><h2>Why this talk</h2></header>
        <div className="body" style={{ display: 'grid', gap: 10 }}>
          {detail.whyNow.map((row) => (
            <article key={row.title + row.why} data-testid="why-talk">
              <b>{tidyTalkTitle(row.title)}</b> <span className="chip">{kindLabel(row.kind)}</span>
              <div>{plainWhy(row.why)}</div>
            </article>
          ))}
          {!detail.whyNow.length ? <p>No tagged talks to put forward yet.</p> : null}
        </div>
      </section>
      <section className="panel" style={{ marginBottom: 18 }} data-testid="feed-pushed">
        <header><h2>What the feed has put forward</h2></header>
        <div className="body" style={{ display: 'grid', gap: 10 }}>
          {combineServes(detail.serves.map((row) => ({ ...row, title: tidyTalkTitle(row.title) }))).map((row) => (
            <article key={row.title} data-testid="serve-row">
              <b>{row.title}</b> {row.kinds.map((kind) => <span key={kind} className="chip">{kindLabel(kind)}</span>)} <span className="chip">{row.engaged ? 'Watched' : 'Not yet'}</span>
              <div className="hint">{compassDate(row.at)}. {plainWhy(row.why)}</div>
            </article>
          ))}
          {!detail.serves.length ? <p>Nothing put forward yet.</p> : null}
        </div>
      </section>
      <section className="panel" data-testid="attribution">
        <header><h2>What was watched between looks</h2></header>
        <div className="body" style={{ display: 'grid', gap: 12 }}>
          {detail.attribution.map((row) => (
            <article key={`${row.scale}-${row.from}-${row.to}`} data-testid="attribution-row" data-scale={row.scale}>
              <b>{row.name}</b> moved from {signed(row.from)} to {signed(row.to)}.
              <div className="hint">{row.talks.length ? `Watched in that area: ${row.talks.map((title) => tidyTalkTitle(title)).join(', ')}` : 'No tagged talk in that area between these looks.'}</div>
            </article>
          ))}
          {!detail.attribution.length ? <p>One look so far, so there is no change to set beside a talk.</p> : null}
        </div>
      </section>
    </AdminFrame>
  )
}
