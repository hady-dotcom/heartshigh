import Link from 'next/link'
import { loadDoors } from '@/server/doors'
import { doorLabel, doorOfClause } from '@/lib/doors'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import type { Payload } from 'payload'
import { Hidden } from '@/components/app/shell'
import { CodeLimits, CodeStatus } from '@/components/desk/codes'
import { ViewAsButton } from '@/components/desk/view-as-button'
import { parseOption } from '@/lib/placing'
import { portalDisplayName, showPortalName } from '@/lib/portal-name'
import type { SessionUser } from '@/server/context'
import { one, ref, rows, str } from '../common'
import { CourseEditorBody } from './content'
import { DeskFrame, masterNav } from './shell'

type MasterCtx = { payload: Payload; user: SessionUser; query: { error?: string; notice?: string; part?: string } }

function kindLabel(value: unknown) {
  const text = str(value).replace(/[_-]+/g, ' ').trim()
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function MasterFrame({ ctx, active, title, intro, children, testId }: { ctx: MasterCtx; active: string; title: string; intro?: ReactNode; children: ReactNode; testId?: string }) {
  return (
    <DeskFrame payload={ctx.payload} user={ctx.user} title={title} intro={intro} active={active} nav={masterNav()} brand="HEARTS" subBrand="Master desk" brandHref="/master" query={ctx.query} testId={testId}>
      {children}
    </DeskFrame>
  )
}

export async function MasterPortals(ctx: MasterCtx) {
  const { payload } = ctx
  const [portals, packs, codes, people] = await Promise.all([
    rows(payload, 'portals', undefined, { sort: 'name' }),
    rows(payload, 'packs', undefined, { sort: 'title' }),
    rows(payload, 'access-codes', undefined, { sort: 'code', limit: 1000 }),
    rows(payload, 'users', undefined, { limit: 2000 }),
  ])
  const inPortal = (person: Record<string, unknown>, id: number) => ((person.tenants as { tenant?: unknown }[]) || []).some((row) => ref(row.tenant) === id)
  return (
    <MasterFrame ctx={ctx} active="portals" title="Portals" intro="Each mosque or community has its own portal, with its own admin, codes and people. You open portals here; each portal admin runs their own." testId="master">
      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Portal</th><th>Address</th><th>Kind</th><th>Status</th><th className="num">People</th><th className="num">Codes</th><th /></tr></thead>
            <tbody>
              {portals.map((portal) => (
                <tr key={portal.id} data-testid="portal-card">
                  <td><b>{portalDisplayName(portal)}</b></td>
                  <td style={{ fontFamily: 'ui-monospace, monospace' }}>/p/{str(portal.slug)}</td>
                  <td>{kindLabel(portal.kind)}</td>
                  <td>{portal.closed ? <span className="badge rose">Deactivated</span> : <span className="badge teal">Active</span>}</td>
                  <td className="num">{people.filter((person) => inPortal(person, portal.id)).length}</td>
                  <td className="num">{codes.filter((code) => ref(code.portal) === portal.id).length}</td>
                  <td style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <Link className="btn ghost small" href={`/p/${str(portal.slug)}/admin`}>Open admin</Link>
                    {(() => {
                      const admin = people.find((person) => person.role === 'portal-admin' && inPortal(person, portal.id))
                      return admin ? <ViewAsButton targetId={admin.id} name={str(admin.name) || 'the portal admin'} landing={`/p/${str(portal.slug)}/admin`} /> : null
                    })()}
                    <form action="/api/hearts" method="post">
                      <Hidden fields={{ action: 'deactivate', portalSlug: str(portal.slug), closed: portal.closed ? 'no' : 'yes', next: '/master' }} />
                      <button className={`btn ${portal.closed ? 'teal' : 'danger'} small`} data-testid="deactivate-portal" type="submit">{portal.closed ? 'Activate' : 'Deactivate'}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel" style={{ marginBottom: 18 }}>
        <header><div><h2>Access codes</h2><p>Seeded codes are random each time the demo is reseeded; the seed prints them too</p></div></header>
        <div className="table-wrap">
          <table className="data" data-testid="master-codes">
            <thead><tr><th>Portal</th><th>Code</th><th>Label</th><th>For</th><th>Works</th></tr></thead>
            <tbody>
              {codes.map((code) => (
                <tr key={code.id} data-testid="master-code-row" data-label={str(code.label)}>
                  <td>{str(portals.find((portal) => portal.id === ref(code.portal))?.name)}</td>
                  <td style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>{str(code.code)}</td>
                  <td>{str(code.label)}</td>
                  <td>{str(code.role)}</td>
                  <td><CodeStatus code={code} next="/master" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="grid three" style={{ alignItems: 'start' }}>
        <section className="panel">
          <header><div><h2>Open a portal</h2></div></header>
          <form className="body form" action="/api/hearts" method="post">
            <Hidden fields={{ action: 'create-portal' }} />
            <label className="stack">Name<input type="text" data-testid="create-portal-name" name="name" placeholder="Harbour Mosque" required /></label>
            <label className="stack">Short address<input type="text" data-testid="create-portal-slug" name="slug" placeholder="harbour" required /></label>
            <label className="stack">Kind
              <select name="kind" defaultValue="mosque"><option value="mosque">Mosque</option><option value="church">Church</option><option value="synagogue">Synagogue</option><option value="other">Other</option></select>
            </label>
            <label className="stack">Welcome line<textarea name="welcome" placeholder="A few words for people arriving" /></label>
            <div className="actions"><button className="btn ink" data-testid="create-portal-submit" type="submit">Open portal</button></div>
          </form>
        </section>
        <section className="panel">
          <header><div><h2>Access code for a portal</h2><p>The first admin code is how a portal admin gets in</p></div></header>
          <form className="body form" action="/api/hearts" method="post">
            <Hidden fields={{ action: 'create-code', next: '/master' }} />
            <label className="stack">Portal<select name="portalSlug" data-testid="code-portal">{portals.map((portal) => <option key={portal.id} value={str(portal.slug)}>{showPortalName(portal.name)}</option>)}</select></label>
            <label className="stack">Code<input type="text" data-testid="code-value" name="code" placeholder="Leave empty for a random code" /></label>
            <label className="stack">For
              <select data-testid="code-role" name="role" defaultValue="admin"><option value="admin">Admin</option><option value="teacher">Teacher</option><option value="learner">Learner</option><option value="parent">Parent</option></select>
            </label>
            <label className="stack">Teacher code
              <select data-testid="code-teacher" name="linkedTeacherCode">
                <option value="">None</option>
                {codes.filter((code) => code.role === 'teacher').map((code) => <option key={code.id} value={code.id}>{str(code.code)}</option>)}
              </select>
            </label>
            <label className="stack">Course pack
              <select data-testid="code-pack" name="pack">{packs.map((pack) => <option key={pack.id} value={pack.id}>{str(pack.title)}{pack.owner === 'master' ? ' (library)' : ''}</option>)}</select>
            </label>
            <CodeLimits />
            <div className="actions"><button className="btn ink" data-testid="create-code" type="submit">Make code</button></div>
            <p className="hint">Join links look like /join?code=THE-CODE</p>
          </form>
        </section>
        <section className="panel">
          <header><div><h2>Course pack for a portal</h2></div></header>
          <form className="body form" action="/api/hearts" method="post">
            <Hidden fields={{ action: 'create-pack', next: '/master' }} />
            <label className="stack">Portal<select name="portalSlug" data-testid="pack-portal">{portals.map((portal) => <option key={portal.id} value={str(portal.slug)}>{showPortalName(portal.name)}</option>)}</select></label>
            <label className="stack">Pack name<input type="text" data-testid="portal-pack-title" name="title" placeholder="Harbour sittings" required /></label>
            <div className="actions"><button className="btn ghost" type="submit" data-testid="portal-pack-save">Save pack</button></div>
          </form>
        </section>
      </div>
    </MasterFrame>
  )
}

export async function MasterLibrary(ctx: MasterCtx) {
  const { payload } = ctx
  const [courses, packs] = await Promise.all([rows(payload, 'courses', { origin: { equals: 'master' } }, { sort: 'title' }), rows(payload, 'packs', { owner: { equals: 'master' } }, { sort: 'title' })])
  const ids = courses.map((course) => course.id)
  const [lessons, cuts, adoptions] = await Promise.all([
    ids.length ? rows(payload, 'lessons', { course: { in: ids } }) : Promise.resolve([]),
    ids.length ? rows(payload, 'cuts', { course: { in: ids } }, { limit: 2000 }) : Promise.resolve([]),
    rows(payload, 'adoptions', undefined, { limit: 1000 }),
  ])
  return (
    <MasterFrame ctx={ctx} active="library" title="Library" intro="The shared courses every portal can link. Portals see changes made here straight away." testId="master-library">
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 300px', alignItems: 'start' }}>
        <section className="panel">
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Course</th><th>Speaker</th><th className="num">Films</th><th className="num">Approved</th><th className="num">To review</th><th className="num">Portals</th><th /></tr></thead>
              <tbody>
                {courses.map((course) => {
                  const own = cuts.filter((cut) => ref(cut.course) === course.id)
                  const linkedBy = new Set(adoptions.filter((row) => ref(row.course) === course.id || packs.some((pack) => ref(row.pack) === pack.id && ((pack.courses as unknown[]) || []).some((item) => ref(item) === course.id))).map((row) => ref(row.portal)))
                  return (
                    <tr key={course.id} data-testid="master-course">
                      <td><Link href={`/master/library/${course.id}`} style={{ fontWeight: 700 }}>{str(course.title)}</Link></td>
                      <td>{str(course.speaker)}</td>
                      <td className="num">{lessons.filter((lesson) => ref(lesson.course) === course.id).length}</td>
                      <td className="num">{own.filter((cut) => cut.status === 'approved').length}</td>
                      <td className="num">{own.filter((cut) => cut.status === 'draft').length}</td>
                      <td className="num">{linkedBy.size}</td>
                      <td><Link className="btn ghost small" href={`/master/library/${course.id}`}>Edit</Link></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <header><div><h2>New library course</h2></div></header>
          <form className="body form" action="/api/hearts" method="post">
            <Hidden fields={{ action: 'create-course', origin: 'master', next: '/master/library' }} />
            <label className="stack">Title<input type="text" data-testid="master-course-title" name="title" required /></label>
            <label className="stack">Speaker<input type="text" name="speaker" /></label>
            <label className="stack">Summary<textarea name="summary" /></label>
            <label className="stack">Add to a library pack
              <select name="pack"><option value="">Not yet</option>{packs.map((pack) => <option key={pack.id} value={pack.id}>{str(pack.title)}</option>)}</select>
            </label>
            <div className="actions"><button className="btn ink" type="submit">Add to the library</button></div>
          </form>
        </section>
      </div>
    </MasterFrame>
  )
}

export async function MasterCourse(ctx: MasterCtx, courseId: number) {
  const course = await one(ctx.payload, 'courses', courseId)
  if (!course) notFound()
  const body = await CourseEditorBody({ payload: ctx.payload, user: ctx.user, portal: null, editorHref: `/master/library/${courseId}`, courseId, part: ctx.query.part })
  return (
    <MasterFrame ctx={ctx} active="library" title={str(course.title)} intro={<Link href="/master/library">‹ Library</Link>} testId="master-course">
      {body}
    </MasterFrame>
  )
}

export async function MasterPacks(ctx: MasterCtx) {
  const { payload } = ctx
  const [packs, courses, portals] = await Promise.all([rows(payload, 'packs', undefined, { sort: 'title' }), rows(payload, 'courses', undefined, { sort: 'title' }), rows(payload, 'portals')])
  const library = courses.filter((course) => course.origin === 'master')
  return (
    <MasterFrame ctx={ctx} active="packs" title="Course packs" intro="A pack is the set of courses an access code opens. Library packs can be linked by any portal; portal packs belong to one portal." testId="master-packs">
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.7fr) minmax(320px, 1fr)', alignItems: 'start' }}>
        <section className="panel">
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Pack</th><th>Belongs to</th><th>Courses</th></tr></thead>
              <tbody>
                {packs.map((pack) => {
                  const inside = ((pack.courses as unknown[]) || []).map((item) => ref(item))
                  const portal = portals.find((row) => row.id === ref(pack.portal))
                  return (
                    <tr key={pack.id} data-testid="pack-row">
                      <td><b>{str(pack.title)}</b></td>
                      <td>{pack.owner === 'master' ? <span className="badge gold">Library</span> : <span className="badge grey">{showPortalName(portal?.name)}</span>}</td>
                      <td>
                        {pack.owner === 'master' ? (
                          <form action="/api/hearts" method="post" style={{ display: 'grid', gap: 8 }}>
                            <Hidden fields={{ action: 'pack-courses', pack: pack.id, next: '/master/packs' }} />
                            <div className="checks">{library.map((course) => <label className="check" key={course.id}><input type="checkbox" name="course" value={course.id} defaultChecked={inside.includes(course.id)} /> {str(course.title)}</label>)}</div>
                            <div><button className="btn ghost small" type="submit" data-testid="pack-save">Save courses</button></div>
                          </form>
                        ) : (() => {
                          const named = courses.filter((course) => inside.includes(course.id))
                          return named.length ? (
                            <details data-testid="pack-courses">
                              <summary>{named.length} course{named.length === 1 ? '' : 's'}</summary>
                              <ul>{named.map((course) => <li key={course.id}>{str(course.title)}</li>)}</ul>
                            </details>
                          ) : <span className="hint">Empty</span>
                        })()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <header><div><h2>New library pack</h2></div></header>
          <form className="body form" action="/api/hearts" method="post">
            <Hidden fields={{ action: 'create-pack', owner: 'master', next: '/master/packs' }} />
            <label className="stack">Pack name<input type="text" data-testid="master-pack-title" name="title" required /></label>
            <label className="stack">Summary<textarea name="summary" /></label>
            <div className="actions"><button className="btn ink" type="submit">Save pack</button></div>
          </form>
        </section>
      </div>
    </MasterFrame>
  )
}

export async function MasterQuestions(ctx: MasterCtx) {
  const { payload } = ctx
  const [questions, portals] = await Promise.all([rows(payload, 'placing-questions', undefined, { sort: 'order', limit: 60 }), rows(payload, 'portals')])
  const [clauses, doors] = await Promise.all([rows(payload, 'clauses', undefined, { sort: 'number', limit: 50 }), loadDoors(payload)])
  const fragment = (n: number | null) => {
    const door = doorOfClause(n, doors)
    if (!n || !door) return 'No door'
    return <><span data-testid="placing-door">{doorLabel(door)}</span> <span style={{ opacity: 0.75 }}>(clause {n}. {str(clauses.find((row) => Number(row.number) === n)?.fragment)})</span></>
  }
  return (
    <MasterFrame ctx={ctx} active="questions" title="Placing questions" intro="Asked once when someone joins, so their first talk is a gentle place to start. Each answer points to a door of Hadith Jibril; the door with most answers chooses the first course." testId="master-questions">
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.7fr) minmax(320px, 1fr)', alignItems: 'start' }}>
        <section className="panel">
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th className="num">Order</th><th>Question</th><th>Answers and the door each points to</th><th>Shown in</th></tr></thead>
              <tbody>
                {questions.map((question) => (
                  <tr key={question.id} data-testid="placing-row">
                    <td className="num">{str(question.order)}</td>
                    <td><b>{str(question.prompt)}</b>{question.why ? <div className="hint">{str(question.why)}</div> : null}</td>
                    <td>{(Array.isArray(question.options) ? question.options : []).map((option, index) => { const parsed = parseOption(option); return <div key={index} className="hint"><b style={{ color: 'var(--ink)' }}>{parsed.label}</b>: {fragment(parsed.clause)}</div> })}</td>
                    <td>{question.portal ? str(portals.find((row) => row.id === ref(question.portal))?.name) : 'Every portal'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <header><div><h2>New question</h2><p>Put the door after a bar, for example: With prayer | W5. A clause number still works: With prayer | 15</p></div></header>
          <form className="body form" action="/api/hearts" method="post">
            <Hidden fields={{ action: 'placing-question', next: '/master/questions' }} />
            <label className="stack">Question<textarea data-testid="placing-prompt" name="prompt" required /></label>
            <label className="stack">Why we ask<input type="text" name="why" /></label>
            <label className="stack">Answers, one on each line<textarea data-testid="placing-options" name="options" required /></label>
            <label className="stack">Order<input type="number" name="order" defaultValue={questions.length + 1} /></label>
            <label className="stack">Shown in
              <select name="portalSlug"><option value="">Every portal</option>{portals.map((portal) => <option key={portal.id} value={str(portal.slug)}>{showPortalName(portal.name)}</option>)}</select>
            </label>
            <div className="actions"><button className="btn ink" type="submit" data-testid="placing-save">Save question</button></div>
          </form>
        </section>
      </div>
    </MasterFrame>
  )
}
