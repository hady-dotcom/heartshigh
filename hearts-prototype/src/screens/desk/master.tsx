import Link from 'next/link'
import { loadDoors } from '@/server/doors'
import { doorLabel, doorOfClause } from '@/lib/doors'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import type { Payload } from 'payload'
import { Hidden } from '@/components/app/shell'
import { LibraryCoursePicker } from '@/components/desk/library-picker'
import { loadLibraryPicker, openedByLines } from '@/server/code-courses'
import { CodeLimits, CodeStatus } from '@/components/desk/codes'
import { ViewAsButton } from '@/components/desk/view-as-button'
import { parseOption } from '@/lib/placing'
import { portalDisplayName, showPortalName } from '@/lib/portal-name'
import type { SessionUser } from '@/server/context'
import { counted, librarySummary, youtubeThumb, youtubeWatch } from '@/lib/library-catalogue'
import { Pager } from '@/components/desk/pager'
import { libraryPage, libraryTotals } from '@/server/library-catalogue'
import { one, ref, rows, str } from '../common'
import { listShortTalks } from '@/server/short-talks'
import { CourseEditorBody } from './content'
import { DeskFrame, masterNav } from './shell'
import { TooShortFilter, TooShortTable } from './short-talks'
import { DeleteInline, DeleteMany, DeletePick } from '@/components/desk/delete-controls'
import { courseRemovedFromDesk } from '@/lib/desk-delete'
import { openBinRecordIds } from '@/server/desk-delete'
import { TalkDetail, TalkFinder } from './library-talks'

export type MasterCtx = { payload: Payload; user: SessionUser; query: { error?: string; notice?: string; part?: string; page?: string; films?: string; show?: string; q?: string; teacher?: string; door?: string; status?: string; length?: string; source?: string; added?: string; tp?: string } }

function kindLabel(value: unknown) {
  const text = str(value).replace(/[_-]+/g, ' ').trim()
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function MasterFrame({ ctx, active, title, intro, children, testId, showOnPhone }: { ctx: MasterCtx; active: string; title: string; intro?: ReactNode; children: ReactNode; testId?: string; showOnPhone?: boolean }) {
  return (
    <DeskFrame payload={ctx.payload} user={ctx.user} title={title} intro={intro} active={active} nav={masterNav()} brand="HEARTS" subBrand="Master desk" brandHref="/master" query={ctx.query} testId={testId} showOnPhone={showOnPhone}>
      {children}
    </DeskFrame>
  )
}

export async function MasterPortals(ctx: MasterCtx) {
  const { payload } = ctx
  const [portals, codes, people, library] = await Promise.all([
    rows(payload, 'portals', undefined, { sort: 'name' }),
    rows(payload, 'access-codes', undefined, { sort: 'code', limit: 1000 }),
    rows(payload, 'users', undefined, { limit: 2000 }),
    loadLibraryPicker(payload),
  ])
  const inPortal = (person: Record<string, unknown>, id: number) => ((person.tenants as { tenant?: unknown }[]) || []).some((row) => ref(row.tenant) === id)
  const binned = await openBinRecordIds(payload, 'portal')
  const openPortals = portals.filter((portal) => !binned.has(portal.id))
  return (
    <MasterFrame ctx={ctx} active="portals" title="Portals" intro="Each mosque or community has its own portal, with its own admin, codes and people. You open portals here; each portal admin runs their own." testId="master">
      <p className="hint" style={{ marginTop: 0 }}><Link href="/demo-stage" data-testid="open-demo-stage">Open the demo stage</Link> — four people on one page. A course, a note, a question, and a reply move between them. Nothing is saved.</p>
      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Portal</th><th>Address</th><th>Kind</th><th>Status</th><th className="num">People</th><th className="num">Codes</th><th /></tr></thead>
            <tbody>
              {openPortals.map((portal) => (
                <tr key={portal.id} data-testid="portal-card">
                  <td><b>{portalDisplayName(portal)}</b></td>
                  <td style={{ fontFamily: 'ui-monospace, monospace' }}>/p/{str(portal.slug)}</td>
                  <td>{kindLabel(portal.kind)}</td>
                  <td>{portal.closed ? <span className="badge rose">Deactivated</span> : <span className="badge teal">Active</span>}</td>
                  <td className="num">{people.filter((person) => inPortal(person, portal.id)).length}</td>
                  <td className="num">{codes.filter((code) => ref(code.portal) === portal.id).length}</td>
                  <td style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <Link className="btn ghost small" href={`/master/portals/${str(portal.slug)}`} data-testid="edit-portal">Features</Link>
                    <Link className="btn ghost small" href={`/p/${str(portal.slug)}/admin`} data-testid="run-portal">Run this portal</Link>
                    {(() => {
                      const admin = people.find((person) => person.role === 'portal-admin' && inPortal(person, portal.id))
                      return admin ? <ViewAsButton targetId={admin.id} name={str(admin.name) || 'the portal admin'} landing={`/p/${str(portal.slug)}/admin`} /> : null
                    })()}
                    <details className="danger-zone" data-testid="danger-zone">
                      <summary>Danger zone</summary>
                      <form action="/api/hearts" method="post">
                        <Hidden fields={{ action: 'deactivate', portalSlug: str(portal.slug), closed: portal.closed ? 'no' : 'yes', next: '/master' }} />
                        {portal.closed ? null : <label className="check"><input type="checkbox" name="confirm" value="yes" required data-testid="deactivate-confirm" /> I understand learners cannot sign in</label>}
                        <button className={`btn ${portal.closed ? 'teal' : 'danger'} small`} data-testid="deactivate-portal" type="submit">{portal.closed ? 'Activate' : 'Deactivate'}</button>
                      </form>
                      <DeleteInline kind="portal" id={portal.id} next="/master" testId={`delete-portal-${portal.id}`} title={portalDisplayName(portal)} label="Delete portal" />
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel" style={{ marginBottom: 18 }}>
        <header><div><h2>Access codes</h2></div></header>
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
      <div className="grid two" style={{ alignItems: 'start' }}>
        <section className="panel">
          <header><div><h2>Open a portal</h2><p><Link href="/master/create" data-testid="open-portal-studio">Choose courses and features</Link> when you want to pick which parts this place has.</p></div></header>
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
            <LibraryCoursePicker courses={library} testId="master-code-courses" />
            <CodeLimits />
            <div className="actions"><button className="btn ink" data-testid="create-code" type="submit">Make code</button></div>
            <p className="hint">Join links look like /join?code=THE-CODE</p>
          </form>
        </section>
      </div>
    </MasterFrame>
  )
}

function libraryHref(page: number, showShort: boolean) {
  const params = new URLSearchParams()
  if (showShort) params.set('show', 'too-short')
  if (page > 1) params.set('page', String(page))
  const text = params.toString()
  return text ? `/master/library?${text}` : '/master/library'
}

export async function MasterLibrary(ctx: MasterCtx) {
  const { payload } = ctx
  const showingShort = ctx.query.show === 'too-short'
  const [totals, listed, openers, shortTalks] = await Promise.all([
    libraryTotals(payload),
    libraryPage(payload, ctx.query.page),
    openedByLines(payload),
    listShortTalks(payload),
  ])
  return (
    <MasterFrame ctx={ctx} active="library" title="Library" intro="Search talks, then open one. Courses sit underneath. Each course says which codes and portals can open it." testId="master-library" showOnPhone>
      <TalkFinder payload={payload} base="/master/library" bringInHref="/master/bring-in" query={ctx.query} />
      <TooShortFilter base="/master/library" count={shortTalks.length} active={showingShort} />
      {showingShort ? <TooShortTable talks={shortTalks} next="/master/library?show=too-short" /> : null}
      <p className="library-totals" data-testid="library-totals" data-courses={totals.courses} data-films={totals.films} data-playable={totals.playable} data-clips={totals.clips}>{librarySummary(totals)}</p>
      <div className="library-layout">
        <section className="panel">
          <div className="library-list" data-testid="library-list">
            <DeleteMany kind="course" next="/master/library" formId="bulk-course" />
            {listed.courses.filter((course) => !courseRemovedFromDesk(course as { hidden?: boolean | null; hiddenNote?: unknown })).map((course) => {
              const stat = listed.stats.get(course.id) || { films: 0, approved: 0, youtubeId: null }
              const thumb = youtubeThumb(stat.youtubeId)
              const watch = youtubeWatch(stat.youtubeId)
              return (
                <article key={course.id} className={`library-course${thumb ? '' : ' no-thumb'}`} data-testid="master-course" data-films={stat.films} data-approved={stat.approved} data-hidden={course.hidden ? 'yes' : 'no'}>
                  {thumb && watch ? (
                    <a className="library-thumb" href={watch} target="_blank" rel="noopener noreferrer" data-testid="course-watch">
                      <img src={thumb} alt="" width={320} height={180} data-testid="course-thumb" />
                      <span>Watch</span>
                    </a>
                  ) : null}
                  <div className="library-course-copy">
                    <Link href={`/master/library/${course.id}`} data-testid="course-open">{str(course.title)}</Link>
                    {str(course.speaker) ? <p>{str(course.speaker)}</p> : null}
                    {course.hidden && course.hiddenNote ? <p className="hint" data-testid="course-hidden-note">{str(course.hiddenNote)}</p> : null}
                    <p className="library-counts">
                      <span data-testid="course-films">{counted(stat.films, 'film', 'films')}</span>
                      <span data-testid="course-approved">{counted(stat.approved, 'approved clip', 'approved clips')}</span>
                    </p>
                    <span className="opened-by" data-testid="opened-by">{openers.get(course.id) || 'No code or portal opens this yet.'}</span>
                    <Link href={`/master/library/${course.id}`}>Edit</Link>
                    <DeletePick formId="bulk-course" id={course.id} label={str(course.title)} />
                    <DeleteInline kind="course" id={course.id} next="/master/library" testId={`delete-course-${course.id}`} />
                  </div>
                </article>
              )
            })}
          </div>
          <Pager page={listed.page} pages={listed.pages} hrefFor={(page) => libraryHref(page, showingShort)} />
        </section>
        <section className="panel" id="new-library-course">
          <header><div><h2>New library course</h2></div></header>
          <form className="body form" action="/api/hearts" method="post">
            <Hidden fields={{ action: 'create-course', origin: 'master', next: '/master/library' }} />
            <label className="stack">Title<input type="text" data-testid="master-course-title" name="title" required /></label>
            <label className="stack">Speaker<input type="text" name="speaker" /></label>
            <label className="stack">Summary<textarea name="summary" /></label>
            <div className="actions"><button className="btn ink" type="submit">Add to the library</button></div>
          </form>
        </section>
      </div>
    </MasterFrame>
  )
}

export async function MasterTalk(ctx: MasterCtx, talkId: number) {
  return (
    <MasterFrame ctx={ctx} active="library" title="Talk" intro={<Link href="/master/library">‹ Library</Link>} testId="master-talk" showOnPhone>
      <TalkDetail payload={ctx.payload} id={talkId} base="/master/library" courseBase="/master/library" binHref="/master/bin" bringInHref="/master/bring-in" manageAll portalId={null} />
    </MasterFrame>
  )
}

export async function MasterCourse(ctx: MasterCtx, courseId: number) {
  const course = await one(ctx.payload, 'courses', courseId)
  if (!course) notFound()
  const body = await CourseEditorBody({ payload: ctx.payload, user: ctx.user, portal: null, editorHref: `/master/library/${courseId}`, courseId, part: ctx.query.part, filmsPage: ctx.query.films })
  return (
    <MasterFrame ctx={ctx} active="library" title={str(course.title)} intro={<Link href="/master/library">‹ Library</Link>} testId="master-course" showOnPhone>
      {body}
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
    const words = str(clauses.find((row) => Number(row.number) === n)?.fragment)
    return <><span data-testid="placing-door">{doorLabel(door)}</span>{words ? <span style={{ opacity: 0.75 }}> {words}</span> : null}</>
  }
  return (
    <MasterFrame ctx={ctx} active="questions" title="Placing questions" intro="Asked once when someone joins, so their first talk is a gentle place to start. Each answer points to a door of Hadith Jibril; the door with most answers chooses the first course." testId="master-questions">
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.7fr) minmax(320px, 1fr)', alignItems: 'start' }}>
        <section className="panel">
          <DeleteMany kind="placing" next="/master/questions" formId="bulk-placing" />
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th className="num">Order</th><th>Question</th><th>Answers and the door each points to</th><th>Shown in</th></tr></thead>
              <tbody>
                {questions.map((question) => (
                  <tr key={question.id} data-testid="placing-row">
                    <td className="num">{str(question.order)}</td>
                    <td><b>{str(question.prompt)}</b>{question.why ? <div className="hint">{str(question.why)}</div> : null}</td>
                    <td>{(Array.isArray(question.options) ? question.options : []).map((option, index) => { const parsed = parseOption(option); return <div key={index} className="hint"><b style={{ color: 'var(--ink)' }}>{parsed.label}</b>: {fragment(parsed.clause)}</div> })}</td>
                    <td>
                      {question.portal ? str(portals.find((row) => row.id === ref(question.portal))?.name) : 'Every portal'}
                      <DeletePick formId="bulk-placing" id={question.id} label={str(question.prompt)} />
                      <DeleteInline kind="placing" id={question.id} next="/master/questions" testId={`delete-placing-${question.id}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel" id="new-question">
          <header><div><h2>New question</h2><p>Put the door after a bar, for example: With prayer | W5. A plain number finds the door too: With prayer | 5.</p></div></header>
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
