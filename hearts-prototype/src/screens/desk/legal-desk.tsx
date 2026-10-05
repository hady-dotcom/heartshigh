import { Hidden } from '@/components/app/shell'
import { HelpTip } from '@/components/desk/help'
import { PAGE } from '@/lib/desk-help'
import { LEGAL_KINDS, type LegalKind } from '@/lib/legal'
import { longDate, rows, str } from '../common'
import { MasterFrame, type MasterCtx } from './master'

const LABELS: Record<LegalKind, string> = {
  privacy: 'Privacy notice',
  terms: 'Terms of use',
  guidelines: 'Community guidelines',
  'portal-agreement': 'Portal agreement',
}

export async function MasterLegalScreen(ctx: MasterCtx) {
  const pages = await rows(ctx.payload, 'legal-pages', undefined, { sort: '-updatedAt', limit: 40 })
  const latest = new Map<string, (typeof pages)[number]>()
  for (const page of pages) {
    if (!latest.has(String(page.kind))) latest.set(String(page.kind), page)
  }
  return (
    <MasterFrame ctx={ctx} active="legal" title="Legal pages" intro="Draft wording for adviser review. Publishing a new version asks people to agree again." testId="master-legal">
      {LEGAL_KINDS.map((kind) => {
        const page = latest.get(kind)
        return (
          <section key={kind} className="panel" style={{ marginBottom: 18 }} data-testid={`legal-edit-${kind}`}>
            <header className="light"><h2>{LABELS[kind]} {page?.draftForAdviserReview !== false ? <span className="hint">Draft for adviser review</span> : null} <HelpTip topic="legal">{PAGE.legal}</HelpTip></h2></header>
            <form className="body form" action="/api/hearts" method="post">
              <Hidden fields={{ action: 'save-legal-page', kind, id: page?.id, next: '/master/legal' }} />
              <label className="row"><span>Version</span><input className="field" name="version" defaultValue={str(page?.version)} data-testid={`legal-version-${kind}`} /></label>
              <label className="row"><span>Title</span><input className="field" name="title" defaultValue={str(page?.title)} required /></label>
              <label className="row top"><span>One-line summary</span><textarea name="summary" defaultValue={str(page?.summary)} required rows={2} /></label>
              <label className="row top"><span>Full text</span><textarea name="body" defaultValue={str(page?.body)} required rows={12} data-testid={`legal-body-${kind}`} /></label>
              <label className="check"><input type="checkbox" name="draftForAdviserReview" defaultChecked={page?.draftForAdviserReview !== false} /> Draft for adviser review</label>
              <div className="actions">
                <button className="btn ghost" type="submit">Save draft</button>
              </div>
            </form>
            {page ? (
              <form className="body" action="/api/hearts" method="post">
                <Hidden fields={{ action: 'publish-legal-page', id: page.id, version: str(page.version), next: '/master/legal' }} />
                <button className="btn ink" type="submit" data-testid={`legal-publish-${kind}`}>Publish this version</button>
              </form>
            ) : null}
          </section>
        )
      })}
    </MasterFrame>
  )
}

export async function MasterHelpRequests(ctx: MasterCtx) {
  const notes = await rows(ctx.payload, 'help-requests', undefined, { sort: '-createdAt', limit: 80, depth: 1 })
  return (
    <MasterFrame ctx={ctx} active="help-requests" title="Help requests" intro="Things that are not working, learning questions, and worries." testId="master-help-requests">
      <section className="panel">
        <header className="light"><h2>Inbox <HelpTip topic="help-requests">{PAGE.helpRequests}</HelpTip></h2></header>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>When</th><th>Kind</th><th>Person</th><th>Page</th><th>Note</th></tr></thead>
            <tbody>
              {notes.map((row) => (
                <tr key={row.id} data-testid="help-row">
                  <td>{longDate(row.happenedAt || row.createdAt)}</td>
                  <td>{str(row.kind)}</td>
                  <td>{str((row.user as { name?: string; email?: string } | null)?.name || (row.user as { email?: string } | null)?.email)}</td>
                  <td>{str(row.page)}</td>
                  <td>{str(row.note)}</td>
                </tr>
              ))}
              {!notes.length ? <tr><td colSpan={5} className="empty">Nothing yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </MasterFrame>
  )
}
