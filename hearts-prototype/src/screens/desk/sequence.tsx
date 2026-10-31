import Link from 'next/link'
import { AdminFrame } from '@/screens/desk/overview'
import { Hidden } from '@/components/app/shell'
import { GiveCourse } from '@/components/desk/give-course'
import { SequenceList } from '@/components/desk/sequence-list'
import { FEATURE_KEYS, featuresOf } from '@/lib/features'
import { readSaidAnswers } from '@/lib/said-answers'
import { PARENTING_DEMO_CODE, learnerAnswers, watchedCount, withDemoQuery } from '@/lib/parenting-demo'
import { SEQUENCE_COPY, kineticMomentsOn } from '@/lib/sequence'
import { sharedAnswerText, sharedAnswersNewestFirst } from '@/lib/shared-answers'
import { portalWithDemoFeatures } from '@/server/parenting-demo'
import { KINETIC_COPY, PLAYBACK_COPY, SEQUENCE_FEATURE_COPY } from '@/lib/sequence-features'
import { sortParts } from '@/lib/part-order'
import { needsCover } from '@/lib/supplied-cover'
import { portalPeople, ref, rows, str, type Ctx } from '../common'

export async function SequenceDesk(ctx: Ctx) {
  const { payload, portal, base, user } = ctx
  const courses = await rows(payload, 'courses', { and: [{ origin: { equals: 'local' } }, { portal: { equals: portal.id } }, { hidden: { not_equals: true } }] }, { sort: 'createdAt', limit: 5 })
  const course = courses[0]
  const lessonRows = course ? await rows(payload, 'lessons', { course: { equals: course.id } }, { sort: 'order' }) : []
  const lessons = sortParts(lessonRows, () => 0)
  const canEdit = !ctx.demo && (user.role === 'master' || user.role === 'portal-admin')
  const next = ctx.demo ? withDemoQuery(`${base}/admin/sequence`, ctx.demo.token, ctx.demo.role) : `${base}/admin/sequence`
  return (
    <AdminFrame ctx={ctx} active="sequence" title="Course films" intro={ctx.demo ? 'These are the live films. Open one to play it. This room does not change the course.' : 'Add films in the order people should watch them. Drag a row, or use Move up and Move down. Titles can be changed.'} testId="sequence-desk" showOnPhone>
      {canEdit ? <p data-testid="sequence-paste-help">{SEQUENCE_COPY.paste}</p> : null}
      {canEdit ? <p data-testid="sequence-example-note">{SEQUENCE_COPY.examples}</p> : null}
      {canEdit ? (
        <form className="form-stack panel" action="/api/hearts" method="post" encType="multipart/form-data" data-testid="sequence-import-form">
          <Hidden fields={{ action: 'sequence-import', portalSlug: portal.slug, next }} />
          <label className="row top">
            <span>Paste links</span>
            <textarea name="links" data-testid="sequence-paste" placeholder="https://www.youtube.com/watch?v=…" rows={6} />
          </label>
          <label className="row">
            <span>Or a CSV file</span>
            <input type="file" name="sheet" accept=".csv,text/csv,text/plain" data-testid="sequence-sheet" />
          </label>
          <button className="pill ink" type="submit" data-testid="sequence-import">Add films</button>
        </form>
      ) : null}
      {ctx.demo && course ? (
        <ol className="sequence-list" data-testid="sequence-edit">
          {lessons.map((row, index) => (
            <li key={row.id} data-testid="sequence-film">
              <Link href={withDemoQuery(`${base}/course/${course.id}?part=${row.id}`, ctx.demo!.token, ctx.demo!.role)}>
                <span className="sequence-num">{index + 1}</span> {str(row.title)}
              </Link>
            </li>
          ))}
        </ol>
      ) : lessons.length ? (
        <SequenceList rows={lessons.map((row) => ({ id: row.id, title: str(row.title), needsCover: needsCover({ kind: 'film', id: row.id, title: str(row.title), uploaded: Boolean(ref(row.cover)), courseId: course?.id, courseTitle: str(course?.title) }) }))} portalSlug={portal.slug} next={next} />
      ) : <p>No films yet. Paste a list to start.</p>}
      {canEdit ? (
        <form className="form-stack panel" id="look" action="/api/hearts" method="post" data-testid="sequence-settings-form">
          <h2>How this portal looks</h2>
          <Hidden fields={{ action: 'sequence-settings', portalSlug: portal.slug, next }} />
          <label className="row"><span>Name</span><input name="name" defaultValue={str(portal.organisationName || portal.name)} data-testid="sequence-name-input" /></label>
          <label className="row"><span>Name people see</span><input name="brandName" defaultValue={str(portal.brandName)} data-testid="sequence-brand" placeholder="Hady Home" /></label>
          <label className="row top"><span>Welcome line</span><textarea name="welcome" defaultValue={str(portal.welcome)} data-testid="sequence-welcome" /></label>
          <label className="row"><span>Colour</span><input name="colour" defaultValue={portal.colour || '#1f3a5f'} data-testid="sequence-colour" /></label>
          <label className="row"><span>Second colour</span><input name="accent" defaultValue={portal.accent || '#e07a5f'} data-testid="sequence-accent" /></label>
          <label className="row"><span>Logo</span><input name="logoUrl" defaultValue={str(portal.logoUrl)} placeholder="/icons/hady-home.svg or https://" data-testid="sequence-logo" /></label>
          <label className="row">
            <span>Order</span>
            <select name="lockOrder" defaultValue={portal.lockOrder === false ? 'no' : 'yes'} data-testid="sequence-lock">
              <option value="yes">{SEQUENCE_COPY.lockedOrder}</option>
              <option value="no">{SEQUENCE_COPY.anyOrder}</option>
            </select>
          </label>
          <label className="row">
            <span>Length</span>
            <select name="minTalk" defaultValue={Number(portal.minTalkSeconds) === 300 ? '300' : '0'} data-testid="sequence-min">
              <option value="0">{SEQUENCE_COPY.shortOk}</option>
              <option value="300">{SEQUENCE_COPY.shortOff}</option>
            </select>
          </label>
          <button className="pill ink" type="submit" data-testid="sequence-save-settings">Save look</button>
        </form>
      ) : null}
      {canEdit ? <p><a className="pill outline" href={`/api/hearts/export-app?portal=${encodeURIComponent(portal.slug)}${portal.slug === 'parenting' ? `&code=${PARENTING_DEMO_CODE}` : ''}`} data-testid="export-app">{SEQUENCE_COPY.export}</a></p> : null}
      {canEdit && portal.slug === 'parenting' ? <p><a className="pill outline" href="/downloads/guiding-home-learning.zip" data-testid="export-download">Download the app</a> <span data-testid="demo-join-code">Join code {PARENTING_DEMO_CODE}</span></p> : null}
    </AdminFrame>
  )
}

export async function SequenceOverview(ctx: Ctx) {
  if (ctx.demo) return demoOverview(ctx)
  const { payload, portal, base } = ctx
  const courses = await rows(payload, 'courses', { and: [{ origin: { equals: 'local' } }, { portal: { equals: portal.id } }] })
  const courseIds = courses.map((row) => row.id)
  const [lessons, codes, people] = await Promise.all([
    courseIds.length ? rows(payload, 'lessons', { course: { in: courseIds } }) : Promise.resolve([]),
    rows(payload, 'access-codes', { portal: { equals: portal.id } }),
    portalPeople(payload, portal.id),
  ])
  return (
    <AdminFrame ctx={ctx} active="overview" title="Overview" intro="Films, people, and codes for this course." testId="sequence-overview" showOnPhone>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        <div className="count-tile"><span>Films</span><b data-testid="sequence-film-count">{lessons.length}</b></div>
        <div className="count-tile"><span>People</span><b data-testid="sequence-people-count">{people.length}</b></div>
        <div className="count-tile"><span>Codes</span><b data-testid="sequence-code-count">{codes.length}</b></div>
      </div>
      <p style={{ marginTop: 16 }}><Link className="pill ink" href={`${base}/admin/sequence`}>Course films</Link></p>
    </AdminFrame>
  )
}

export async function SequenceFeatures(ctx: Ctx) {
  const portal = ctx.demo ? portalWithDemoFeatures(ctx.portal, ctx.demo.state) : ctx.portal
  const view = ctx.demo ? { ...ctx, portal } : ctx
  const { base } = view
  const map = featuresOf(portal)
  const kinetic = kineticMomentsOn(portal)
  const next = ctx.demo ? withDemoQuery(`${base}/admin/features`, ctx.demo.token, ctx.demo.role) : `${base}/admin/features`
  return (
    <AdminFrame ctx={view} active="features" title="Features" intro="Switch parts on or off for this course. Saving happens straight away." testId="sequence-features" showOnPhone>
      <form className="form-stack panel" action={ctx.demo ? '/api/hearts/demo' : '/api/hearts'} method="post" data-testid="sequence-features-form">
        <Hidden fields={{ action: 'sequence-features', portalSlug: portal.slug, next, ...(ctx.demo ? { demo: ctx.demo.token, demoAs: ctx.demo.role } : {}) }} />
        <label className="check" data-testid="feature-row-kinetic">
          <input type="checkbox" name="kinetic" value="on" defaultChecked={kinetic} data-testid="feature-kinetic" />
          <span><b>{KINETIC_COPY.name}</b><small style={{ display: 'block' }}>{KINETIC_COPY.what}</small></span>
        </label>
        {FEATURE_KEYS.map((key) => (
          <label className="check" key={key} data-testid={`feature-row-${key}`}>
            <input type="checkbox" name="feature" value={key} defaultChecked={map[key]} data-testid={`feature-${key}`} />
            <span><b>{SEQUENCE_FEATURE_COPY[key].name}</b><small style={{ display: 'block' }}>{SEQUENCE_FEATURE_COPY[key].what}</small></span>
          </label>
        ))}
        <p data-testid="feature-playback"><b>{PLAYBACK_COPY.name}.</b> {PLAYBACK_COPY.what}</p>
        <button className="pill ink" type="submit" data-testid="sequence-save-features">Save features</button>
      </form>
    </AdminFrame>
  )
}

export async function SequenceCodes(ctx: Ctx) {
  if (ctx.demo) return demoCodes(ctx)
  const { payload, portal, base, user } = ctx
  const codes = await rows(payload, 'access-codes', { portal: { equals: portal.id } }, { sort: 'label' })
  const teachers = codes.filter((row) => row.role === 'teacher' && row.disabled !== true)
  const canEdit = user.role === 'master' || user.role === 'portal-admin'
  const next = `${base}/admin/access`
  return (
    <AdminFrame ctx={ctx} active="access" title="Codes" intro="Codes open this course only." testId="sequence-codes" showOnPhone>
      <ul data-testid="sequence-code-list">
        {codes.map((row) => (
          <li key={row.id} data-testid="sequence-code-row">{str(row.label) || 'Code'} · {str(row.role)}</li>
        ))}
      </ul>
      {canEdit ? (
        <form className="form-stack panel" id="new-code" action="/api/hearts" method="post" data-testid="sequence-code-form">
          <Hidden fields={{ action: 'create-code', portalSlug: portal.slug, next }} />
          <label className="row">
            <span>Who it is for</span>
            <select name="role" defaultValue="learner" data-testid="sequence-code-role">
              <option value="learner">Learner</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="row"><span>Label</span><input name="label" data-testid="sequence-code-label" placeholder="A short name" /></label>
          {teachers.length ? (
            <label className="row">
              <span>Teacher</span>
              <select name="linkedTeacherCode" defaultValue={String(teachers[0].id)} data-testid="sequence-code-teacher">
                {teachers.map((row) => <option key={row.id} value={row.id}>{str(row.label) || 'Teacher'}</option>)}
              </select>
            </label>
          ) : null}
          <button className="pill ink" type="submit" data-testid="sequence-code-save">Make a code</button>
        </form>
      ) : null}
    </AdminFrame>
  )
}

async function SharedWithGroup({ payload, portalId }: { payload: Ctx['payload']; portalId: number }) {
  const answers = await rows(payload, 'answers', { and: [{ portal: { equals: portalId } }, { shareWithLearners: { equals: true } }, { keepPrivate: { not_equals: true } }] }, { depth: 1, sort: '-createdAt', limit: 40 })
  return (
    <section className="panel" data-testid="group-shared">
      <h2>Shared with the group</h2>
      {answers.length ? answers.map((answer) => {
        const person = answer.user as { name?: string } | number | null
        const name = person && typeof person === 'object' ? str(person.name) : 'A learner'
        return <p key={answer.id} data-testid="group-shared-answer"><b>{name || 'A learner'}.</b> {sharedAnswerText({ body: answer.body, choice: answer.choice, video: answer.video, audio: answer.audio, image: answer.image })}</p>
      }) : <p data-testid="group-shared-empty">No answers have been shared with other learners yet.</p>}
    </section>
  )
}

async function SharedWithTeacher({ payload, portalId }: { payload: Ctx['payload']; portalId: number }) {
  const answers = await rows(payload, 'answers', { and: [{ portal: { equals: portalId } }, { shareWithTeacher: { equals: true } }, { keepPrivate: { not_equals: true } }] }, { depth: 1, sort: '-createdAt', limit: 40 })
  const shared = sharedAnswersNewestFirst(answers)
  return (
    <section className="panel" data-testid="teacher-shared">
      <h2>Shared with you</h2>
      {shared.length ? shared.map((answer) => {
        const person = answer.user as { name?: string } | number | null
        const name = person && typeof person === 'object' ? str(person.name) : 'A learner'
        return <p key={answer.id} data-testid="teacher-shared-answer"><b>{name || 'A learner'}.</b> {sharedAnswerText({ body: answer.body, choice: answer.choice, video: answer.video, audio: answer.audio, image: answer.image })}</p>
      }) : <p data-testid="teacher-shared-empty">No shared answers yet.</p>}
    </section>
  )
}

async function ParentSaid({ payload, portalId, base, film }: { payload: Ctx['payload']; portalId: number; base: string; film?: string }) {
  const { sequenceCourseFor } = await import('@/server/sequence-desk')
  const course = await sequenceCourseFor(payload, portalId)
  const all = readSaidAnswers((course as { sampleAnswers?: unknown } | null)?.sampleAnswers)
  const orders = [...new Set(all.map((row) => row.order))].sort((a, b) => a - b)
  const current = Number(film || orders[0] || 0)
  const rows = all.filter((row) => row.order === current)
  const phases = [...new Set(rows.map((row) => row.phase))]
  return (
    <section className="panel" data-testid="what-parents-said">
      <h2>What parents said</h2>
      <p className="muted">Lines stored on this course. They are not attached to learner accounts.</p>
      <p>
        {orders.map((order) => (
          <Link key={order} href={`${base}${base.includes('?') ? '&' : '?'}film=${order}`} style={{ marginRight: 8 }}>{order}</Link>
        ))}
      </p>
      {phases.length ? phases.map((phase) => (
        <div key={phase} data-testid="parent-phase">
          <h3>{rows.find((row) => row.phase === phase)?.label || phase}</h3>
          {rows.filter((row) => row.phase === phase).map((row, index) => (
            <p key={`${phase}-${index}`} data-testid="parent-said"><span className="muted">{row.label}. </span>{row.text}</p>
          ))}
        </div>
      )) : <p>No parent notes on this film yet.</p>}
    </section>
  )
}

function TeacherGroupCode({ slug, next, codes }: { slug: string; next: string; codes: { id: number; code: string }[] }) {
  return (
    <section className="panel" data-testid="teacher-group" style={{ marginBottom: 18 }}>
      <header><div><h2>A code for your group</h2><p>People who use it see the same courses as you.</p></div></header>
      <form className="body form" action="/api/hearts" method="post">
        <Hidden fields={{ action: 'teacher-group-code', portalSlug: slug, next }} />
        <label className="stack">Code<input type="text" name="code" data-testid="group-code" placeholder="Leave empty for a random code" /></label>
        <div className="actions"><button className="btn ink" type="submit" data-testid="group-code-save">Make a group code</button></div>
      </form>
      {codes.map((row) => <p key={row.id} data-testid="group-code-row">{row.code}</p>)}
    </section>
  )
}

export async function SequenceLearners(ctx: Ctx) {
  if (ctx.demo) return demoLearners(ctx)
  const { payload, portal, base, user } = ctx
  const people = await portalPeople(payload, portal.id)
  const learners = people.filter((person) => person.role === 'learner')
  const courses = await rows(payload, 'courses', { and: [{ origin: { equals: 'local' } }, { portal: { equals: portal.id } }, { hidden: { not_equals: true } }] }, { sort: 'title' })
  const here = `${base}/admin/teach`
  const teacherCodeId = user.role === 'teacher' ? ref(user.accessCode) : 0
  const groupCodes = teacherCodeId
    ? await rows(payload, 'access-codes', { and: [{ portal: { equals: portal.id } }, { role: { equals: 'learner' } }, { linkedTeacherCode: { equals: teacherCodeId } }] }, { sort: '-createdAt', limit: 20 })
    : []
  return (
    <AdminFrame ctx={ctx} active="teach" title="Learners" intro="People in this course." testId="sequence-learners" showOnPhone>
      {user.role === 'teacher' ? <TeacherGroupCode slug={portal.slug} next={here} codes={groupCodes.map((row) => ({ id: row.id, code: str(row.code) }))} /> : null}
      <section className="panel" id="learner-list" data-testid="give-course-panel">
        <header><div><h2>Give this course</h2><p>Search by name, then tick who should have it.</p></div></header>
        <div className="body">
          <GiveCourse
            learners={learners.map((learner) => ({ id: learner.id, name: str(learner.name) || 'Learner' }))}
            courses={courses.map((course) => ({ id: course.id, title: str(course.title), door: 'Films' }))}
            next={here}
          />
        </div>
      </section>
      <p data-testid="teacher-name">{user.name || 'Teacher'}</p>
      {await SharedWithTeacher({ payload, portalId: portal.id })}
      {await SharedWithGroup({ payload, portalId: portal.id })}
      {await ParentSaid({ payload, portalId: portal.id, base: here, film: ctx.query.film })}
      {learners.length ? (
        <ul data-testid="sequence-learner-list">
          {learners.map((learner) => <li key={learner.id} data-testid="sequence-learner">{str(learner.name)}</li>)}
        </ul>
      ) : <p data-testid="sequence-empty-learners">No learners yet.</p>}
    </AdminFrame>
  )
}

async function filmTotal(ctx: Ctx) {
  const courses = await rows(ctx.payload, 'courses', { and: [{ origin: { equals: 'local' } }, { portal: { equals: ctx.portal.id } }] })
  const courseIds = courses.map((row) => row.id)
  if (!courseIds.length) return 0
  const lessons = await rows(ctx.payload, 'lessons', { course: { in: courseIds } })
  return lessons.length
}

async function demoOverview(ctx: Ctx) {
  const demo = ctx.demo!
  const films = await filmTotal(ctx)
  const learners = demo.state.people.filter((person) => person.role === 'learner')
  const here = withDemoQuery(`${ctx.base}/admin`, demo.token, demo.role)
  return (
    <AdminFrame ctx={ctx} active="overview" title="Overview" intro="Films, people, and the latest answers. This practice room does not change real learners." testId="sequence-overview" showOnPhone>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        <div className="count-tile"><span>Films</span><b data-testid="sequence-film-count">{films}</b></div>
        <div className="count-tile"><span>People</span><b data-testid="sequence-people-count">{demo.state.people.length}</b></div>
        <div className="count-tile"><span>Codes</span><b data-testid="sequence-code-count">1</b></div>
      </div>
      <p data-testid="demo-join-code">Join code {PARENTING_DEMO_CODE}. It opens this course.</p>
      {await ParentSaid({ payload: ctx.payload, portalId: ctx.portal.id, base: here, film: ctx.query.film })}
      <ul data-testid="demo-answer-list">
        {demo.state.answers.filter((answer) => answer.source !== 'real').map((answer) => (
          <li key={answer.id} data-testid="demo-answer">
            <b>{answer.learner}</b> on {answer.film}: {answer.body}
            {answer.phaseLabel ? <span> {answer.phaseLabel}</span> : null}
            {answer.reply ? <span data-testid="demo-reply"> Reply: {answer.reply}</span> : null}
          </li>
        ))}
      </ul>
      <p style={{ marginTop: 16 }}><Link className="pill ink" href={withDemoQuery(`${ctx.base}/admin/teach`, demo.token, demo.role)}>Learners</Link> <Link className="pill outline" href={withDemoQuery(`${ctx.base}/admin/features`, demo.token, demo.role)}>Features</Link></p>
      <p className="muted">Latest note: {demo.state.notes[0]?.body}</p>
      <p className="muted">{learners.length} learners are in this practice room. <Link href={here}>Refresh</Link></p>
    </AdminFrame>
  )
}

function demoCodes(ctx: Ctx) {
  const demo = ctx.demo!
  const next = withDemoQuery(`${ctx.base}/admin/access`, demo.token, demo.role)
  return (
    <AdminFrame ctx={ctx} active="access" title="Codes" intro="This practice room shows the demo code only. Real codes stay hidden." testId="sequence-codes" showOnPhone>
      <ul data-testid="sequence-code-list">
        <li data-testid="sequence-code-row">Parenting demo · learner · {PARENTING_DEMO_CODE}</li>
      </ul>
      <p>Anyone with {PARENTING_DEMO_CODE} joins the course. This room’s practice people are separate.</p>
      <p><Link className="pill outline" href={next}>Back</Link></p>
    </AdminFrame>
  )
}

async function demoLearners(ctx: Ctx) {
  const demo = ctx.demo!
  const who = ctx.query.who || ''
  const focus = demo.state.people.find((person) => person.name === who && person.role === 'learner')
  const next = withDemoQuery(focus ? `${ctx.base}/admin/teach?who=${encodeURIComponent(focus.name)}` : `${ctx.base}/admin/teach`, demo.token, demo.role)
  const canNote = demo.role === 'teacher' || demo.role === 'portal' || demo.role === 'master'
  return (
    <AdminFrame ctx={ctx} active="teach" title="Learners" intro="What people watched, and the answers they sent." testId="sequence-learners" showOnPhone>
      {canNote ? (
        <form className="form-stack panel" action="/api/hearts/demo" method="post" data-testid="demo-note-form">
          <h2>Send a note</h2>
          <Hidden fields={{ action: 'note', demo: demo.token, demoAs: demo.role, from: demo.cast.teacher, next: withDemoQuery(`${ctx.base}/admin/teach`, demo.token, demo.role) }} />
          <label className="row top"><span>Note</span><textarea name="body" required data-testid="demo-note-body" placeholder="A short note for the home page" /></label>
          <button className="pill ink" type="submit" data-testid="demo-note-send">Send note</button>
        </form>
      ) : null}
      {await ParentSaid({ payload: ctx.payload, portalId: ctx.portal.id, base: withDemoQuery(`${ctx.base}/admin/teach`, demo.token, demo.role), film: ctx.query.film })}
      <ul data-testid="demo-answer-list">
        {demo.state.answers.filter((answer) => answer.source !== 'real').map((answer) => (
          <li key={answer.id} data-testid="demo-answer">
            <Link href={withDemoQuery(`${ctx.base}/admin/teach?who=${encodeURIComponent(answer.learner)}`, demo.token, demo.role)}>
              <b>{answer.learner}</b> on {answer.film}
            </Link>
            <p>{answer.body}</p>
          </li>
        ))}
      </ul>
      <ul data-testid="sequence-learner-list">
        {demo.state.people.filter((person) => person.role === 'learner').map((person) => (
          <li key={person.name} data-testid="sequence-learner">
            <Link href={withDemoQuery(`${ctx.base}/admin/teach?who=${encodeURIComponent(person.name)}`, demo.token, demo.role)} data-testid={`demo-learner-${person.name}`}>
              <b>{person.name}</b>
            </Link>
            <span> · {watchedCount(demo.state, person.name)} films watched{person.watching ? ` · watching ${person.watching}` : ''}</span>
          </li>
        ))}
      </ul>
      {focus ? (
        <section className="panel" data-testid="demo-learner-open">
          <h2>{focus.name}</h2>
          <p>{watchedCount(demo.state, focus.name)} films watched. {focus.watching ? `Now on ${focus.watching}.` : 'Not in a film right now.'}</p>
          <ul>
            {learnerAnswers(demo.state, focus.name).map((answer) => (
              <li key={answer.id} data-testid="demo-answer">
                <p><b>{answer.film}</b></p>
                <p>{answer.prompt}</p>
                <p>{answer.body}</p>
                {answer.reply ? <p data-testid="demo-reply">Reply: {answer.reply}</p> : null}
                {canNote && !answer.reply ? (
                  <form action="/api/hearts/demo" method="post">
                    <Hidden fields={{ action: 'reply', id: answer.id, demo: demo.token, demoAs: demo.role, next }} />
                    <label className="row top"><span>Reply</span><textarea name="body" required data-testid="demo-reply-body" /></label>
                    <button className="pill ink" type="submit" data-testid="demo-reply-send">Send reply</button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AdminFrame>
  )
}
