import { Hidden } from '@/components/app/shell'
import { HelpTip } from '@/components/desk/help'
import { CLASS_COLOURS, classColour } from '@/lib/class-palette'
import { TOOL } from '@/lib/desk-help'
import { classGroups, classesInPortal } from '@/server/classes'
import type { Ctx } from '../common'
import { portalPeople, ref, rows, str } from '../common'
import { AdminFrame } from './overview'

export async function ClassesScreen(ctx: Ctx) {
  const { payload, portal, base, query } = ctx
  const here = `${base}/admin/classes`
  const [classes, people, codes] = await Promise.all([
    classesInPortal(payload, portal.id),
    portalPeople(payload, portal.id),
    rows(payload, 'access-codes', { portal: { equals: portal.id } }, { sort: 'code' }),
  ])
  const { groups, ungrouped } = classGroups(classes, people.map((person) => ({ id: person.id, name: str(person.name), role: str(person.role) })))
  const openId = Number(query.item || 0)
  return (
    <AdminFrame ctx={ctx} active="classes" title="Classes" intro="Groups inside this portal — a Saturday class, a sisters’ circle, a new Muslims group." testId="admin-classes">
      <section className="panel" style={{ marginBottom: 18 }}>
        <header>
          <div>
            <h2>Classes ({groups.length}) <HelpTip topic="classes">{TOOL.classes}</HelpTip></h2>
            <p>{people.filter((person) => person.role === 'learner').length} learners in the portal. {ungrouped.length} not in a class yet.</p>
          </div>
        </header>
        <div className="body" style={{ display: 'grid', gap: 16 }}>
          {groups.map((group) => {
            const colour = classColour(str(group.class.colour))
            return (
              <details key={group.class.id} open={openId === group.class.id || groups.length <= 4} data-testid="class-card" data-class={group.class.id}>
                <summary style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span aria-hidden style={{ width: 14, height: 14, borderRadius: 99, background: colour, border: '1px solid var(--desk-line)' }} />
                  <b>{str(group.class.name)}</b>
                  <span className="hint">{group.learners.length} learner{group.learners.length === 1 ? '' : 's'} · {group.teachers.length} teacher{group.teachers.length === 1 ? '' : 's'}</span>
                </summary>
                <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
                  <form className="form" action="/api/hearts" method="post">
                    <Hidden fields={{ action: 'class-update', class: group.class.id, portalSlug: portal.slug, next: `${here}?item=${group.class.id}` }} />
                    <div className="cols">
                      <label className="stack">Name<input name="name" defaultValue={str(group.class.name)} required /></label>
                      <label className="stack">Colour
                        <select name="colour" defaultValue={colour}>
                          {CLASS_COLOURS.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="actions"><button className="btn ink small" type="submit">Save class</button></div>
                  </form>
                  <div className="table-wrap">
                    <table className="data">
                      <thead><tr><th>Name</th><th>Role</th><th /></tr></thead>
                      <tbody>
                        {[...group.teachers, ...group.learners].map((person) => (
                          <tr key={person.id} data-testid="class-member">
                            <td>{person.name}</td>
                            <td>{person.role}</td>
                            <td>
                              <form action="/api/hearts" method="post">
                                <Hidden fields={{ action: 'class-members', op: 'remove', class: group.class.id, portalSlug: portal.slug, next: here }} />
                                <input type="hidden" name="person" value={person.id} />
                                <button className="btn ghost small" type="submit">Remove</button>
                              </form>
                            </td>
                          </tr>
                        ))}
                        {!group.count ? <tr><td colSpan={3} className="empty">Nobody in this class yet.</td></tr> : null}
                      </tbody>
                    </table>
                  </div>
                  <form className="form" action="/api/hearts" method="post">
                    <Hidden fields={{ action: 'class-members', op: 'add', class: group.class.id, portalSlug: portal.slug, next: here }} />
                    <label className="stack">Add people
                      <select name="person" multiple size={Math.min(6, Math.max(3, ungrouped.length + 1))} data-testid="class-add-people">
                        {people.filter((person) => person.role === 'learner' || person.role === 'teacher').map((person) => (
                          <option key={person.id} value={person.id}>{str(person.name) || str(person.email)}</option>
                        ))}
                      </select>
                    </label>
                    <p className="hint">Hold Ctrl or Cmd to pick more than one. {ungrouped.length} learner{ungrouped.length === 1 ? '' : 's'} have no class.</p>
                    <div className="actions"><button className="btn teal small" type="submit">Add to class</button></div>
                  </form>
                  {ctx.user.role !== 'teacher' ? (
                    <form className="form" action="/api/hearts" method="post">
                      <Hidden fields={{ action: 'class-join-rule', class: group.class.id, portalSlug: portal.slug, next: here }} />
                      <label className="stack">New joiners on this code land here <HelpTip topic="class-join">{TOOL.classJoin}</HelpTip>
                        <select name="code" data-testid="class-join-code">
                          <option value="">No automatic join</option>
                          {codes.map((code) => <option key={code.id} value={code.id}>{str(code.code)} · {str(code.role)}</option>)}
                        </select>
                      </label>
                      <div className="actions"><button className="btn ghost small" type="submit">Save join rule</button></div>
                    </form>
                  ) : null}
                  <form action="/api/hearts" method="post">
                    <Hidden fields={{ action: 'class-delete', class: group.class.id, portalSlug: portal.slug, next: here }} />
                    <button className="btn danger small" type="submit" data-testid="class-delete">Delete class</button>
                  </form>
                </div>
              </details>
            )
          })}
          {!groups.length ? <p className="empty">No classes yet. Make one below.</p> : null}
        </div>
      </section>
      <section className="panel">
        <header><div><h2>New class</h2><p>A name and a colour. You can add people after it is saved.</p></div></header>
        <form className="body form" action="/api/hearts" method="post" data-testid="class-create-form">
          <Hidden fields={{ action: 'class-create', portalSlug: portal.slug, next: here }} />
          <label className="stack">Name<input name="name" required data-testid="class-name" placeholder="Saturday Year 5" /></label>
          <label className="stack">Colour
            <select name="colour" data-testid="class-colour">
              {CLASS_COLOURS.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
            </select>
          </label>
          <div className="actions"><button className="btn ink" type="submit" data-testid="class-create">Create class</button></div>
        </form>
      </section>
    </AdminFrame>
  )
}
