import type { Payload } from 'payload'
import { idOf } from '@/lib/ids'
import { portalDisplayName, showPortalName } from '@/lib/portal-name'
import { circleAnswerCount } from '@/server/circle'
import type { SessionUser } from '@/server/context'
import type { Ctx, Row } from '../common'
import { rows, str } from '../common'
import { AdminFrame } from './overview'
import { DeskFrame, masterNav } from './shell'

type Query = { error?: string; notice?: string; preview?: string }
type Summary = {
  fileName?: string
  counts?: { create: number; update: number; delete: number; unchanged: number; skipped: number; errors: number }
  errors?: { tab: string; row: number; column: string; message: string }[]
  errorTotal?: number
  warnings?: { tab: string; row: number; column: string; message: string }[]
  warningTotal?: number
  changes?: { tab: string; row: number; action: string; label: string; detail: string }[]
  changeTotal?: number
  newCourses?: number
  packLinks?: number
}

async function loadPreview(payload: Payload, id: string, desk: 'master' | 'portal', portalId: number | null) {
  const numeric = Number(id)
  if (!numeric) return null
  const doc = await payload.findByID({ collection: 'sheet-imports', id: numeric, depth: 0, overrideAccess: true }).catch(() => null) as (Row & { desk?: string; portal?: unknown; summary?: Summary; state?: string }) | null
  if (!doc || doc.desk !== desk) return null
  if (desk === 'portal' && idOf(doc.portal) !== portalId) return null
  return doc
}

async function lastImport(payload: Payload, desk: 'master' | 'portal', portalId: number | null) {
  const where = desk === 'portal'
    ? { and: [{ desk: { equals: 'portal' } }, { portal: { equals: portalId } }, { state: { equals: 'applied' } }] }
    : { and: [{ desk: { equals: 'master' } }, { state: { equals: 'applied' } }] }
  const found = await payload.find({ collection: 'sheet-imports', overrideAccess: true, depth: 0, limit: 1, sort: '-createdAt', where: where as never })
  return (found.docs[0] as unknown as Row | undefined) || null
}

function SheetBody({
  action,
  next,
  desk,
  portalSlug,
  courses,
  portals,
  preview,
  last,
  libraryCounts,
  packs,
}: {
  packs: { id: number; title: string }[]
  action: string
  next: string
  desk: 'master' | 'portal'
  portalSlug?: string
  courses: { id: number; title: string }[]
  portals: { slug: string; name: string }[]
  preview: { id: number; summary: Summary } | null
  last: { id: number; fileName?: string } | null
  libraryCounts: { talks: number; questions: number; resources: number; circle: number }
}) {
  const summary = preview?.summary
  const counts = summary?.counts
  const hidden = (
    <>
      <input type="hidden" name="desk" value={desk} />
      <input type="hidden" name="next" value={next} />
      {portalSlug ? <input type="hidden" name="portal" value={portalSlug} /> : null}
    </>
  )
  return (
    <>
      <p style={{ marginTop: 0 }}><a className="btn" href={desk === 'portal' ? `/p/${portalSlug}/admin/sheet/create` : '/master/sheet/create'} data-testid="sheet-create-link">Build a sheet from a topic</a></p>
      <div className="stats-strip" data-testid="sheet-library-counts">
        <div className="stat-chip"><b>{libraryCounts.talks}</b><span>Talks in this export</span></div>
        <div className="stat-chip"><b>{libraryCounts.questions}</b><span>Questions</span></div>
        <div className="stat-chip"><b>{libraryCounts.resources}</b><span>Resources</span></div>
        <div className="stat-chip" data-testid="sheet-circle-count"><b>{libraryCounts.circle}</b><span>Circle answers (never counted)</span></div>
        <div className="stat-chip"><b>{last ? '1' : '0'}</b><span>Import waiting to undo</span></div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.1fr) minmax(280px, 0.9fr)', alignItems: 'start' }}>
        <section className="panel">
          <header><div><h2>Upload a sheet</h2><p>Nothing is saved until you apply the preview.</p></div></header>
          <form className="body form" action={action} method="post" encType="multipart/form-data" data-testid="sheet-upload">
            {hidden}
            <input type="hidden" name="intent" value="preview" />
            <label className="stack">Scope
              <select name="scope" data-testid="sheet-scope" defaultValue={desk === 'portal' ? 'portal' : 'library'}>
                {desk === 'master' ? <option value="library">Whole library</option> : null}
                <option value="portal">{desk === 'portal' ? 'This portal’s own courses' : 'One portal’s own courses'}</option>
                <option value="course">One course</option>
              </select>
            </label>
            {desk === 'master' && portals.length ? (
              <label className="stack">Portal, when the scope is a portal
                <select name="portal" data-testid="sheet-portal" defaultValue={portals[0]?.slug}>
                  {portals.map((portal) => <option key={portal.slug} value={portal.slug}>{showPortalName(portal.name)}</option>)}
                </select>
              </label>
            ) : null}
            <label className="stack">Course, when the scope is one course
              <select name="course" data-testid="sheet-course">
                <option value="">Whole scope above</option>
                {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
              </select>
            </label>
            <label className="stack">Workbook (.xlsx)
              <input type="file" name="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required data-testid="sheet-file" />
            </label>
            <label className="check" data-testid="sheet-approve-questions"><input type="checkbox" name="approveQuestions" value="on" /> Import questions as approved. A status in the sheet still wins: draft stays a draft, and rejected stays hidden.</label>
            <p className="hint">A blank cell leaves that field as it is. To remove a row, set its status to delete. Times can be seconds, m:ss or h:mm:ss. The CircleAnswers tab adds example answers under a question; they are never counted as answers or tasks.</p>
            <div className="actions"><button className="btn ink" type="submit" data-testid="sheet-preview-submit">Preview import</button></div>
          </form>
        </section>
        <div className="grid">
          <section className="panel">
            <header className="light"><h2>Template and export</h2></header>
            <div className="body form">
              <p className="hint" style={{ marginTop: 0 }}>The same workbook round-trips: export, then import with no edits, and nothing changes. Google Sheets can open it. Download it again as Microsoft Excel before you upload.</p>
              <p><a className="btn ghost" href="/api/hearts/sheet?kind=template" data-testid="sheet-template">Download the blank template</a></p>
              <form action={action} method="get" className="form" data-testid="sheet-export">
                <input type="hidden" name="kind" value="export" />
                <input type="hidden" name="desk" value={desk} />
                {portalSlug ? <input type="hidden" name="portal" value={portalSlug} /> : null}
                <label className="stack">Export
                  <select name="scope" defaultValue={desk === 'portal' ? 'portal' : 'library'} data-testid="sheet-export-scope">
                    {desk === 'master' ? <option value="library">Whole library</option> : null}
                    {desk === 'portal' || desk === 'master' ? <option value="portal">This portal</option> : null}
                  </select>
                </label>
                {desk === 'master' ? (
                  <label className="stack">Portal
                    <select name="portal" defaultValue={portals[0]?.slug || ''}>
                      <option value="">Library, not a portal</option>
                      {portals.map((portal) => <option key={portal.slug} value={portal.slug}>{showPortalName(portal.name)}</option>)}
                    </select>
                  </label>
                ) : null}
                <label className="stack">Or one course
                  <select name="course" data-testid="sheet-export-course">
                    <option value="">All of the scope above</option>
                    {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
                  </select>
                </label>
                <button className="btn" type="submit" data-testid="sheet-export-submit">Download .xlsx</button>
              </form>
            </div>
          </section>
          {last ? (
            <section className="panel">
              <header className="light"><h2>Last import</h2></header>
              <form className="body form" action={action} method="post">
                {hidden}
                <input type="hidden" name="intent" value="undo" />
                <input type="hidden" name="scope" value={desk === 'portal' ? 'portal' : 'library'} />
                <p data-testid="sheet-last">{str(last.fileName) || 'The last workbook'} can be undone. Only the latest import comes back.</p>
                <button className="btn danger" type="submit" data-testid="sheet-undo">Undo the last import</button>
              </form>
            </section>
          ) : null}
        </div>
      </div>
      {summary && counts ? (
        <section className="panel" style={{ marginTop: 18 }} data-testid="sheet-preview">
          <header>
            <div><h2>Preview of {summary.fileName || 'the sheet'}</h2><p>Check this, then apply. Rows with a problem are skipped and nothing is saved until the sheet is clean.</p></div>
          </header>
          <div className="body">
            <div className="stats-strip" data-testid="sheet-counts">
              <div className="stat-chip"><b data-testid="sheet-count-create">{counts.create}</b><span>To add</span></div>
              <div className="stat-chip"><b data-testid="sheet-count-update">{counts.update}</b><span>To update</span></div>
              <div className="stat-chip"><b data-testid="sheet-count-delete">{counts.delete}</b><span>To remove</span></div>
              <div className="stat-chip"><b data-testid="sheet-count-unchanged">{counts.unchanged}</b><span>Unchanged</span></div>
            </div>
            <p className="hint" data-testid="sheet-skipped">{counts.skipped} row{counts.skipped === 1 ? '' : 's'} skipped because of a problem.</p>
            {summary.errors?.length ? (
              <div className="table-wrap">
                <table className="data" data-testid="sheet-errors">
                  <thead><tr><th>Tab</th><th className="num">Row</th><th>Column</th><th>What to fix</th></tr></thead>
                  <tbody>
                    {summary.errors.map((issue, index) => (
                      <tr key={`${issue.tab}-${issue.row}-${issue.column}-${index}`} data-testid="sheet-error-row" style={{ background: '#fff5f5' }}>
                        <td>{issue.tab}</td>
                        <td className="num">{issue.row}</td>
                        <td><code>{issue.column}</code></td>
                        <td>{issue.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {(summary.errorTotal || 0) > (summary.errors?.length || 0) ? <p className="hint">Showing the first {summary.errors?.length} problems of {summary.errorTotal}.</p> : null}
            {summary.warnings?.length ? (
              <div className="table-wrap" style={{ marginTop: 16 }}>
                <table className="data" data-testid="sheet-warnings">
                  <thead><tr><th>Tab</th><th className="num">Row</th><th>Column</th><th>Check this</th></tr></thead>
                  <tbody>
                    {summary.warnings.map((issue, index) => (
                      <tr key={`${issue.tab}-${issue.row}-${issue.column}-${index}`} data-testid="sheet-warning-row">
                        <td>{issue.tab}</td>
                        <td className="num">{issue.row}</td>
                        <td><code>{issue.column}</code></td>
                        <td>{issue.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {summary.warnings?.length ? <p className="hint" data-testid="sheet-warning-note">These rows can still be applied. A warning is not a reason to skip the row.</p> : null}
            {summary.changes?.length ? (
              <div className="table-wrap" style={{ marginTop: 16 }}>
                <table className="data" data-testid="sheet-changes">
                  <thead><tr><th>Tab</th><th className="num">Row</th><th>Change</th><th>What will happen</th></tr></thead>
                  <tbody>
                    {summary.changes.map((change, index) => (
                      <tr key={`${change.tab}-${change.row}-${index}`} data-testid="sheet-change-row">
                        <td>{change.tab}</td>
                        <td className="num">{change.row}</td>
                        <td><span className={`badge ${change.action === 'delete' ? 'rose' : change.action === 'create' ? 'teal' : 'gold'}`}>{change.action}</span> {change.label}</td>
                        <td>{change.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {(summary.changeTotal || 0) > (summary.changes?.length || 0) ? <p className="hint">Showing the first {summary.changes?.length} changes of {summary.changeTotal}.</p> : null}
            {preview?.id ? <p style={{ marginTop: 12 }}><a className="btn ghost" href={`/api/hearts/sheet/create?preview=${preview.id}`} data-testid="sheet-draft-download">Download this draft</a></p> : null}
            <form action={action} method="post" style={{ marginTop: 16 }}>
              {hidden}
              <input type="hidden" name="intent" value="apply" />
              <input type="hidden" name="import" value={preview?.id || ''} />
              <input type="hidden" name="scope" value={desk === 'portal' ? 'portal' : 'library'} />
              {!(counts.errors || counts.skipped) && (summary.newCourses || summary.packLinks) ? (
                <div className="form" style={{ marginBottom: 12 }} data-testid="sheet-pack-options">
                  {summary.newCourses ? (
                    <label className="stack">Add the {summary.newCourses} new course{summary.newCourses === 1 ? '' : 's'} to a pack
                      <select name="newCoursesPack" defaultValue="" data-testid="sheet-new-courses-pack">
                        <option value="">Do not add them to a pack</option>
                        {packs.map((pack) => <option key={pack.id} value={pack.id}>{pack.title}</option>)}
                      </select>
                    </label>
                  ) : null}
                  <label className="check">
                    <input type="checkbox" name="push" data-testid="sheet-push" />
                    {' '}Also give these courses to existing learners who already hold that pack
                  </label>
                  <p className="hint">Off, only people who join with the pack’s codes from now on get the courses. On, learners who already hold the pack get them straight away. Either way the choice is logged, and undo takes them back out.</p>
                </div>
              ) : null}
              {counts.errors || counts.skipped ? <p data-testid="sheet-blocked">Fix the rows above and upload the sheet again. Apply stays off while any row has a problem.</p> : <button className="btn teal" type="submit" data-testid="sheet-apply">Apply this import</button>}
            </form>
          </div>
        </section>
      ) : null}
    </>
  )
}

async function catalogueCounts(payload: Payload, where: Record<string, unknown>, portalId: number | null) {
  const courses = await rows(payload, 'courses', where as never, { limit: 500 })
  const ids = courses.map((course) => course.id)
  if (!ids.length) return { talks: 0, questions: 0, resources: 0, circle: 0 }
  const lessons = await rows(payload, 'lessons', { course: { in: ids } }, { limit: 2000 })
  const lessonIds = lessons.map((lesson) => lesson.id)
  const [questions, resources, circle] = await Promise.all([
    lessonIds.length ? payload.count({ collection: 'engagement-points', overrideAccess: true, where: { lesson: { in: lessonIds } } }) : Promise.resolve({ totalDocs: 0 }),
    lessonIds.length ? payload.count({ collection: 'resources', overrideAccess: true, where: { lesson: { in: lessonIds } } }) : Promise.resolve({ totalDocs: 0 }),
    circleAnswerCount(payload, lessonIds, portalId),
  ])
  return { talks: lessons.length, questions: questions.totalDocs, resources: resources.totalDocs, circle }
}

export async function MasterSheetScreen({ payload, user, query }: { payload: Payload; user: SessionUser; query: Query }) {
  const [courses, portals, preview, last, libraryCounts, packs] = await Promise.all([
    rows(payload, 'courses', { origin: { equals: 'master' } }, { sort: 'title', limit: 500 }),
    rows(payload, 'portals', undefined, { sort: 'name', limit: 200 }),
    query.preview ? loadPreview(payload, query.preview, 'master', null) : Promise.resolve(null),
    lastImport(payload, 'master', null),
    catalogueCounts(payload, { origin: { equals: 'master' } }, null),
    rows(payload, 'packs', undefined, { sort: 'title', limit: 500 }),
  ])
  return (
    <DeskFrame payload={payload} user={user} title="Master sheet" intro="Upload one workbook to add talks and place pop-up questions, or download what is already here. A dry run shows every add, change and problem before anything is saved." active="sheet" nav={masterNav()} brand="HEARTS" subBrand="Master desk" brandHref="/master" query={query} testId="master-sheet">
      <SheetBody
        action="/api/hearts/sheet"
        next="/master/sheet"
        desk="master"
        courses={courses.map((course) => ({ id: course.id, title: str(course.title) }))}
        portals={portals.map((portal) => ({ slug: str(portal.slug), name: portalDisplayName(portal) }))}
        preview={preview ? { id: preview.id, summary: (preview.summary || {}) as Summary } : null}
        last={last ? { id: last.id, fileName: str(last.fileName) } : null}
        libraryCounts={libraryCounts}
        packs={packs.map((pack) => ({ id: pack.id, title: str(pack.title) }))}
      />
    </DeskFrame>
  )
}

export async function PortalSheetScreen(ctx: Ctx) {
  const { payload, portal, base } = ctx
  const query = ctx.query as Ctx['query'] & { preview?: string }
  const [courses, preview, last, libraryCounts, packs] = await Promise.all([
    rows(payload, 'courses', { and: [{ origin: { equals: 'local' } }, { portal: { equals: portal.id } }] }, { sort: 'title', limit: 500 }),
    query.preview ? loadPreview(payload, query.preview, 'portal', portal.id) : Promise.resolve(null),
    lastImport(payload, 'portal', portal.id),
    catalogueCounts(payload, { and: [{ origin: { equals: 'local' } }, { portal: { equals: portal.id } }] }, portal.id),
    rows(payload, 'packs', { and: [{ owner: { equals: 'portal' } }, { portal: { equals: portal.id } }] }, { sort: 'title', limit: 500 }),
  ])
  return (
    <AdminFrame ctx={ctx} active="sheet" title="Master sheet" intro="Load talks and pop-up questions into courses made in this portal. The master library stays as it is." testId="portal-sheet">
      <SheetBody
        action="/api/hearts/sheet"
        next={`${base}/admin/sheet`}
        desk="portal"
        portalSlug={portal.slug}
        courses={courses.map((course) => ({ id: course.id, title: str(course.title) }))}
        portals={[]}
        preview={preview ? { id: preview.id, summary: (preview.summary || {}) as Summary } : null}
        last={last ? { id: last.id, fileName: str(last.fileName) } : null}
        libraryCounts={libraryCounts}
        packs={packs.map((pack) => ({ id: pack.id, title: str(pack.title) }))}
      />
    </AdminFrame>
  )
}
