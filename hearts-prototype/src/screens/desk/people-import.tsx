import { Hidden } from '@/components/app/shell'
import { HelpTip } from '@/components/desk/help'
import { TOOL } from '@/lib/desk-help'
import { PEOPLE_PROBLEM_FILL, type PeopleSheetPreview } from '@/lib/people-sheet'
import type { Ctx } from '../common'
import { AdminFrame } from './overview'

type Stored = { portalId: number; preview: PeopleSheetPreview }

function storedPreview(token?: string) {
  if (!token) return null
  const bag = (globalThis as typeof globalThis & { __heartsPeoplePreview?: Record<string, Stored> }).__heartsPeoplePreview
  return bag?.[token] || null
}

function storedPasswords(token?: string) {
  if (!token) return []
  const bag = (globalThis as typeof globalThis & { __heartsImportPasswords?: Record<string, { passwords: { name: string; email: string; password: string }[] }> }).__heartsImportPasswords
  return bag?.[token]?.passwords || []
}

export async function PeopleImportScreen(ctx: Ctx) {
  const { portal, base, query } = ctx
  const here = `${base}/admin/access/import`
  const token = String((query as { preview?: string }).preview || '')
  const stored = storedPreview(token)
  const preview = stored?.portalId === portal.id ? stored.preview : null
  const imported = Number((query as { imported?: string }).imported || 0)
  const sheet = storedPasswords(String((query as { sheet?: string }).sheet || ''))
  return (
    <AdminFrame ctx={ctx} active="access" title="Add people from a list" intro="A class list becomes accounts. Preview first — nothing is saved until the sheet is clean." testId="admin-people-import">
      {imported ? (
        <section className="panel" style={{ marginBottom: 18 }} data-testid="import-done">
          <header><div><h2>{imported === 1 ? '1 person is in' : `${imported} people are in`}</h2><p>A set-your-password email will go out once mail is on. Until then, print this sheet of temporary passwords for the teacher to share in person.</p></div></header>
          {sheet.length ? (
            <div className="table-wrap">
              <table className="data" data-testid="import-passwords">
                <thead><tr><th>Name</th><th>Email</th><th>Temporary password</th></tr></thead>
                <tbody>
                  {sheet.map((row) => (
                    <tr key={row.email}><td>{row.name}</td><td>{row.email}</td><td style={{ fontFamily: 'ui-monospace, monospace' }}>{row.password}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
      <section className="panel" style={{ marginBottom: 18 }}>
        <header>
          <div>
            <h2>The list <HelpTip topic="people-import">{TOOL.peopleImport}</HelpTip></h2>
            <p>CSV columns: name, email, role, code, class. Role is learner, teacher or admin. The code must already exist in this portal.</p>
          </div>
        </header>
        <form className="body form" action="/api/hearts" method="post" encType="multipart/form-data" data-testid="people-import-form">
          <Hidden fields={{ action: 'people-import-preview', portalSlug: portal.slug, next: here }} />
          <label className="stack">Upload a spreadsheet
            <input type="file" name="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-testid="people-import-file" />
          </label>
          <label className="stack">Or paste rows
            <textarea name="pasted" rows={8} data-testid="people-import-paste" placeholder={'name,email,role,code,class\nAmina,amina@masjid.test,learner,YOUR-CODE,Saturday Year 5'} />
          </label>
          <div className="actions"><button className="btn ink" type="submit" data-testid="people-import-preview">Preview</button></div>
        </form>
      </section>
      {preview ? (
        <section className="panel" data-testid="people-import-preview-table">
          <header>
            <div>
              <h2>Preview · {preview.ready.length} ready · {preview.blocked.length} with a problem</h2>
              <p>Rows with a rose first cell will be skipped. Apply stays off until every row is clean.</p>
            </div>
          </header>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Row</th><th>Name</th><th>Email</th><th>Role</th><th>Code</th><th>Class</th><th>Problem</th></tr></thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.row} data-testid="import-row" data-ok={row.problems.length ? 'no' : 'yes'}>
                    <td style={row.problems.length ? { background: `#${PEOPLE_PROBLEM_FILL.slice(2)}` } : undefined}>{row.row}</td>
                    <td>{row.name}</td>
                    <td>{row.email}</td>
                    <td>{row.role}</td>
                    <td>{row.code}</td>
                    <td>{row.className}</td>
                    <td>{row.problems.map((issue) => issue.message).join(' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.blocked.length ? (
            <p className="hint" data-testid="import-blocked">Fix the marked rows and preview again. Nothing was saved.</p>
          ) : (
            <form className="form" action="/api/hearts" method="post" style={{ marginTop: 12 }}>
              <Hidden fields={{ action: 'people-import-apply', portalSlug: portal.slug, preview: token, next: here }} />
              <button className="btn teal" type="submit" data-testid="people-import-apply">Add {preview.ready.length} {preview.ready.length === 1 ? 'person' : 'people'}</button>
            </form>
          )}
        </section>
      ) : null}
    </AdminFrame>
  )
}
