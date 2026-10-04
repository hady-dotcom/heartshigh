import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SCALE_KEYS, type ScaleKey } from '@/lib/heart'
import { staffLearner, staffPortal } from '@/server/compass'
import { type Ctx, shortDate } from '../common'
import { AdminFrame } from './overview'

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

/** Portal summary: each scale on the signed ladder, and which talks sat beside an upward move. */
export async function PortalCompassScreen(ctx: Ctx) {
  const summary = await staffPortal(ctx.payload, ctx.user, ctx.portal.id)
  if (!summary) notFound()
  return (
    <AdminFrame ctx={ctx} active="compass" title="Compass" intro="The signed scale, from negatives across toward positives. Learners never see these numbers." testId="compass-portal">
      <section className="panel" style={{ marginBottom: 18 }}>
        <header className="light"><h2>The chapter</h2><span className="hint">{summary.learners.length} learners</span></header>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Scale</th><th className="num">Earlier</th><th className="num">Latest</th><th>Talks beside an upward move</th><th className="num">People</th></tr></thead>
            <tbody>
              {summary.scales.map((scale) => (
                <tr key={scale.scale} data-testid="portal-scale" data-scale={scale.scale}>
                  <td><b>{scale.name}</b></td>
                  <td className="num" data-testid="mean-then">{signed(scale.meanThen)}</td>
                  <td className="num" data-testid="mean-now">{signed(scale.meanNow)}</td>
                  <td data-testid="helped-by">{scale.helpedBy.length ? scale.helpedBy.map((item) => `${item.title} (${item.lifts})`).join(', ') : '—'}</td>
                  <td className="num">{scale.learners}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <header className="light"><h2>Each learner</h2></header>
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

/** One learner's signed rungs over time, with the talks watched between looks. */
export async function StaffLearnerCompass(ctx: Ctx, learnerId: number) {
  const learner = await ctx.payload.findByID({ collection: 'users', id: learnerId, overrideAccess: true, depth: 0 }).catch(() => null)
  if (!learner || learner.role !== 'learner') notFound()
  const detail = await staffLearner(ctx.payload, ctx.user, learner as never, ctx.portal.id)
  if (!detail) notFound()
  const columns = detail.attempts
  return (
    <AdminFrame ctx={ctx} active="compass" title={detail.name} intro="Signed rungs from −10 toward +10, and the talks watched in the areas that sat below zero." testId="compass-learner">
      <p><Link href={`${ctx.base}/admin/compass`}>All learners</Link></p>
      {detail.guide.length ? <p data-testid="compass-guide">Rough guide: {detail.guide.join(', ')}. This name stays on this desk.</p> : null}
      <section className="panel" style={{ marginBottom: 18 }}>
        <header className="light"><h2>Over time</h2></header>
        <div className="table-wrap">
          <table className="data" data-testid="scale-chart">
            <thead>
              <tr>
                <th>Scale</th>
                {columns.map((attempt) => <th key={attempt.at} className="num">{shortDate(attempt.at)}<div className="hint">{attempt.bank === 'month' ? 'Month' : 'Opening'}</div></th>)}
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
      <section className="panel" data-testid="attribution">
        <header className="light"><h2>What was watched between looks</h2></header>
        <div className="body" style={{ display: 'grid', gap: 12 }}>
          {detail.attribution.map((row) => (
            <article key={`${row.scale}-${row.from}-${row.to}`} data-testid="attribution-row" data-scale={row.scale}>
              <b>{row.name}</b> moved from {signed(row.from)} to {signed(row.to)}.
              <div className="hint">{row.talks.length ? `Watched in that area: ${row.talks.join(', ')}` : 'No tagged talk in that area between these looks.'}</div>
            </article>
          ))}
          {!detail.attribution.length ? <p>One look so far, so there is no change to set beside a talk.</p> : null}
        </div>
      </section>
    </AdminFrame>
  )
}
