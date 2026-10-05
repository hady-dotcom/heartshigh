import { BulkPeopleBar, PersonTick } from '@/components/desk/bulk-people'
import { HelpTip } from '@/components/desk/help'
import { HideTestFilter } from '@/components/desk/hide-test'
import { TOOL } from '@/lib/desk-help'
import { hideTestFromQuery, visiblePeople } from '@/lib/test-accounts'
import { classesInPortal } from '@/server/classes'
import { idOf } from '@/lib/ids'
import { rows, str } from '../common'
import { MasterFrame, type MasterCtx } from './master'

export async function MasterPeopleScreen(ctx: MasterCtx) {
  const query = ctx.query as { hideTest?: string; showTest?: string; portal?: string }
  const hideTest = hideTestFromQuery(query)
  const portals = await rows(ctx.payload, 'portals', undefined, { sort: 'name' })
  const slug = query.portal || str(portals[0]?.slug)
  const portal = portals.find((row) => str(row.slug) === slug) || portals[0]
  if (!portal) {
    return <MasterFrame ctx={ctx} active="people" title="People" testId="master-people"><p className="empty">No portals yet.</p></MasterFrame>
  }
  const [people, codes, classes, courses] = await Promise.all([
    rows(ctx.payload, 'users', { 'tenants.tenant': { equals: portal.id } }, { limit: 500, sort: 'name' }),
    rows(ctx.payload, 'access-codes', { portal: { equals: portal.id } }, { sort: 'code' }),
    classesInPortal(ctx.payload, portal.id),
    rows(ctx.payload, 'courses', undefined, { limit: 200, sort: 'title' }),
  ])
  const visible = visiblePeople(people.filter((person) => person.role !== 'master'), hideTest)
  const byRole = {
    'portal-admin': visible.filter((person) => person.role === 'portal-admin'),
    teacher: visible.filter((person) => person.role === 'teacher'),
    learner: visible.filter((person) => person.role === 'learner'),
  }
  const here = `/master/people?portal=${encodeURIComponent(str(portal.slug))}`
  const exportHref = `/api/hearts/people.csv?portal=${encodeURIComponent(str(portal.slug))}`
  return (
    <MasterFrame ctx={ctx} active="people" title="People" intro="Everyone in one portal. Tick a group, then give a course, add them to a class, or download the list." testId="master-people">
      <form method="get" action="/master/people" className="form" style={{ marginBottom: 16 }}>
        <label className="stack">Portal
          <select name="portal" defaultValue={str(portal.slug)} data-testid="people-portal">
            {portals.map((row) => <option key={row.id} value={str(row.slug)}>{str(row.name)}</option>)}
          </select>
        </label>
        <button className="btn ghost small" type="submit">Show</button>
      </form>
      <BulkPeopleBar
        portalSlug={str(portal.slug)}
        next={here}
        courses={courses.map((course) => ({ id: course.id, title: str(course.title) }))}
        codes={codes.map((code) => ({ id: code.id, code: str(code.code) }))}
        classes={classes.map((row) => ({ id: row.id, name: str(row.name) }))}
      />
      <section className="panel">
        <header>
          <div>
            <h2>People ({visible.length}) <HelpTip topic="people-export">{TOOL.peopleExport}</HelpTip></h2>
            <p>Grouped by role. Answers are never on the download.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <HideTestFilter action={here} hide={hideTest} />
            {visible.length ? (
              <a className="btn ghost small" href={exportHref} data-testid="people-export">Download CSV</a>
            ) : (
              <span className="btn ghost small" aria-disabled="true" data-testid="people-export" title="Nobody to download">Download CSV</span>
            )}
          </div>
        </header>
        {(['portal-admin', 'teacher', 'learner'] as const).map((role) => (
          <details key={role} open data-testid={`people-group-${role}`}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, margin: '12px 0' }}>
              {role === 'portal-admin' ? 'Portal admins' : role === 'teacher' ? 'Teachers' : 'Learners'} ({byRole[role].length})
            </summary>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th /><th>Name</th><th>Email</th><th>Code</th></tr></thead>
                <tbody>
                  {byRole[role].map((person) => (
                    <tr key={person.id} data-testid="people-row">
                      <td><PersonTick id={person.id} /></td>
                      <td><b>{str(person.name)}</b></td>
                      <td>{str(person.email)}</td>
                      <td>{str(codes.find((code) => code.id === idOf(person.accessCode))?.code)}</td>
                    </tr>
                  ))}
                  {!byRole[role].length ? <tr><td colSpan={4} className="empty">None in this group.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </section>
    </MasterFrame>
  )
}
