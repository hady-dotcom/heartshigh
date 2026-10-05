import { Hidden } from '@/components/app/shell'
import { doorLabel, doorOfClause } from '@/lib/doors'
import { foldPlacingPrompt, PLACING_EXTRA } from '@/lib/placing-bank'
import { parseOption } from '@/lib/placing'
import { showPortalName } from '@/lib/portal-name'
import { loadDoors } from '@/server/doors'
import { type Ctx, ref, rows, str } from '../common'
import { AdminFrame } from './overview'

export async function PortalQuestionsScreen(ctx: Ctx) {
  const { payload, portal, base } = ctx
  const here = `${base}/admin/questions`
  const [questions, clauses, doors] = await Promise.all([
    rows(payload, 'placing-questions', { or: [{ portal: { exists: false } }, { portal: { equals: portal.id } }] }, { sort: 'order', limit: 80 }),
    rows(payload, 'clauses', undefined, { sort: 'number', limit: 50 }),
    loadDoors(payload),
  ])
  const shown = new Set(questions.map((row) => foldPlacingPrompt(str(row.prompt))))
  const extrasLeft = PLACING_EXTRA.filter((row) => !shown.has(foldPlacingPrompt(row.prompt)))
  const fragment = (n: number | null) => {
    const door = doorOfClause(n, doors)
    if (!n || !door) return 'No door'
    return <>{doorLabel(door)} <span className="hint">(clause {n}. {str(clauses.find((row) => Number(row.number) === n)?.fragment)})</span></>
  }
  return (
    <AdminFrame
      ctx={ctx}
      active="questions"
      title="Joining questions"
      intro="Asked once when someone joins, so their first talk is a gentle place to start. The default bank is already on every portal. You can attach more from the HEARTS bank, or add your own for this community only."
      testId="admin-questions"
    >
      <section className="panel" style={{ marginBottom: 18 }} data-testid="placing-default-bank">
        <header className="light"><h2>Default bank</h2><span className="hint">Shown in every portal</span></header>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th className="num">Order</th><th>Question</th><th>Answers</th><th>Whose</th></tr></thead>
            <tbody>
              {questions.map((question) => {
                const own = Boolean(question.portal && ref(question.portal) === portal.id)
                return (
                  <tr key={question.id} data-testid={own ? 'placing-own-row' : 'placing-default-row'}>
                    <td className="num">{str(question.order)}</td>
                    <td><b>{str(question.prompt)}</b>{question.why ? <div className="hint">{str(question.why)}</div> : null}</td>
                    <td>{(Array.isArray(question.options) ? question.options : []).map((option, index) => {
                      const parsed = parseOption(option)
                      return <div key={index} className="hint"><b style={{ color: 'var(--ink)' }}>{parsed.label}</b>: {fragment(parsed.clause)}</div>
                    })}</td>
                    <td>{own ? showPortalName(portal.name) : 'Every portal'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', alignItems: 'start' }}>
        <section className="panel" data-testid="placing-bank-attach">
          <header className="light"><h2>Add from the HEARTS bank</h2><span className="hint">{extrasLeft.length ? `${extrasLeft.length} left to attach` : 'All attached'}</span></header>
          {extrasLeft.length ? (
            <form className="body form" action="/api/hearts" method="post">
              <Hidden fields={{ action: 'placing-bank-attach', portalSlug: portal.slug, next: here }} />
              {extrasLeft.map((row) => (
                <label className="check" key={row.key} data-testid="placing-bank-option">
                  <input type="checkbox" name="bankKey" value={row.key} defaultChecked />
                  <span><b>{row.prompt}</b><span className="hint" style={{ display: 'block' }}>{row.why}</span></span>
                </label>
              ))}
              <div className="actions"><button className="btn ink" type="submit" data-testid="placing-bank-save">Add selected</button></div>
            </form>
          ) : <p className="body hint" style={{ marginBottom: 0 }}>The extra bank is already on {showPortalName(portal.name)}.</p>}
        </section>
        <section className="panel" data-testid="placing-own">
          <header className="light"><h2>Add your own</h2><span className="hint">Stays on this portal</span></header>
          <form className="body form" action="/api/hearts" method="post">
            <Hidden fields={{ action: 'placing-question', portalSlug: portal.slug, next: here }} />
            <label className="stack">Question<textarea data-testid="placing-prompt" name="prompt" required /></label>
            <label className="stack">Why we ask<input type="text" name="why" /></label>
            <label className="stack">Answers, one on each line<textarea data-testid="placing-options" name="options" required placeholder={'With prayer | W5\nWith the Prophet | 3'} /></label>
            <label className="stack">Order<input type="number" name="order" defaultValue={questions.length + 1} /></label>
            <div className="actions"><button className="btn ink" type="submit" data-testid="placing-save">Save question</button></div>
          </form>
        </section>
      </div>
      <p className="hint">The four default questions stay as the master desk set them. Extra and own questions are only asked in {showPortalName(portal.name)}.</p>
    </AdminFrame>
  )
}
