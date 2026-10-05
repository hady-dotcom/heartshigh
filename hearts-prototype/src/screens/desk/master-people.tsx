import { PersonActions } from '@/components/desk/person-actions'
import { HideTestFilter } from '@/components/desk/hide-test'
import { hideTestFromQuery, visiblePeople } from '@/lib/test-accounts'
import { rows, str } from '../common'
import { MasterFrame, type MasterCtx } from './master'

export async function MasterPeople(ctx: MasterCtx) {
  const hideTest = hideTestFromQuery(ctx.query)
  const people = visiblePeople(await rows(ctx.payload, 'users', undefined, { limit: 2000, sort: 'email' }), hideTest)
  return (
    <MasterFrame ctx={ctx} active="learners" title="People" intro="Pause, restore, or change a role. Everyday work for the master desk." testId="master-people">
      <section className="panel">
        <header className="light">
          <h2>Everyone ({people.length})</h2>
          <HideTestFilter action="/master/learners" hide={hideTest} />
        </header>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th /></tr></thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.id} data-testid="master-person-row">
                  <td><b>{str(person.name)}</b></td>
                  <td>{str(person.email)}</td>
                  <td>{str(person.role)}</td>
                  <td>{person.suspendedAt ? <span className="badge rose">Paused</span> : <span className="badge teal">Open</span>}</td>
                  <td>
                    <PersonActions
                      person={person as never}
                      next="/master/learners"
                      canPause={person.role !== 'master'}
                      canTemp={person.role !== 'master'}
                      canRole={person.role !== 'master'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </MasterFrame>
  )
}
