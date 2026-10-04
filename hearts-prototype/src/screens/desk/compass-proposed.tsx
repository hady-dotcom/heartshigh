import { compassPrivacyOn, COMPASS_DISCLOSURE } from '@/lib/compass-privacy'
import { type Ctx } from '../common'
import { AdminFrame } from './overview'

/** Mock of the proposed Compass privacy. Not the live desk. Feature flag defaults off. */
export function ProposedCompassScreen(ctx: Ctx) {
  const live = compassPrivacyOn()
  return (
    <AdminFrame
      ctx={ctx}
      active="compass"
      title="Compass (proposed)"
      intro="A mock for Leon. The live Compass desk is unchanged. Totals only, from ten or more people, and no named scores."
      testId="compass-proposed"
      tone="evening"
    >
      <p className="hint" data-testid="privacy-flag">{live ? 'The privacy flag is on.' : 'The privacy flag is off. This page is only a mock.'}</p>
      <section className="panel" data-testid="proposed-disclosure" style={{ marginBottom: 18 }}>
        <header><h2>What a learner would read first</h2></header>
        <div className="body">
          <p data-testid="compass-disclosure">{COMPASS_DISCLOSURE}</p>
        </div>
      </section>
      <section className="panel" data-testid="proposed-totals" style={{ marginBottom: 18 }}>
        <header><h2>The circle, with no names</h2><span className="hint">Shown only when 10 or more people have sat with it</span></header>
        <div className="body">
          <p data-testid="proposed-line">Many people in your chapter said anger is hard this week.</p>
          <p>A few more asked for habits that hold.</p>
          <p className="hint">Below ten people, this panel stays empty. There is no per-person page, and Desire / Sexuality is not tied to one name.</p>
        </div>
      </section>
      <p><a href={`${ctx.base}/admin/compass`}>Back to the live Compass</a></p>
    </AdminFrame>
  )
}
