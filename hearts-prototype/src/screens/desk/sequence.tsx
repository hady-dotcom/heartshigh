import Link from 'next/link'
import { AdminFrame } from '@/screens/desk/overview'
import { Hidden } from '@/components/app/shell'
import { GiveCourse } from '@/components/desk/give-course'
import { SequenceList } from '@/components/desk/sequence-list'
import { FEATURE_KEYS, featuresOf } from '@/lib/features'
import { SEQUENCE_COPY, kineticMomentsOn } from '@/lib/sequence'
import { KINETIC_COPY, PLAYBACK_COPY, SEQUENCE_FEATURE_COPY } from '@/lib/sequence-features'
import { sortParts } from '@/lib/part-order'
import { portalPeople, rows, str, type Ctx } from '../common'

export async function SequenceDesk(ctx: Ctx) {
  const { payload, portal, base, user } = ctx
  const courses = await rows(payload, 'courses', { and: [{ origin: { equals: 'local' } }, { portal: { equals: portal.id } }, { hidden: { not_equals: true } }] }, { sort: 'createdAt', limit: 5 })
  const course = courses[0]
  const lessonRows = course ? await rows(payload, 'lessons', { course: { equals: course.id } }, { sort: 'order' }) : []
  const lessons = sortParts(lessonRows, () => 0)
  const canEdit = user.role === 'master' || user.role === 'portal-admin'
  const next = `${base}/admin/sequence`
  return (
    <AdminFrame ctx={ctx} active="sequence" title="Course films" intro="Add films in the order people should watch them. Drag a row, or use Move up and Move down. Titles can be changed." testId="sequence-desk" showOnPhone>
      <p data-testid="sequence-paste-help">{SEQUENCE_COPY.paste}</p>
      <p data-testid="sequence-example-note">{SEQUENCE_COPY.examples}</p>
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
      {lessons.length ? (
        <SequenceList rows={lessons.map((row) => ({ id: row.id, title: str(row.title) }))} portalSlug={portal.slug} next={next} />
      ) : <p>No films yet. Paste a list to start.</p>}
      {canEdit ? (
        <form className="form-stack panel" id="look" action="/api/hearts" method="post" data-testid="sequence-settings-form">
          <h2>How this portal looks</h2>
          <Hidden fields={{ action: 'sequence-settings', portalSlug: portal.slug, next }} />
          <label className="row"><span>Name</span><input name="name" defaultValue={str(portal.organisationName || portal.name)} data-testid="sequence-name-input" /></label>
          <label className="row top"><span>Welcome line</span><textarea name="welcome" defaultValue={str(portal.welcome)} data-testid="sequence-welcome" /></label>
          <label className="row"><span>Colour</span><input name="colour" defaultValue={portal.colour || '#1f3a5f'} data-testid="sequence-colour" /></label>
          <label className="row"><span>Second colour</span><input name="accent" defaultValue={portal.accent || '#e07a5f'} data-testid="sequence-accent" /></label>
          <label className="row"><span>Logo link</span><input name="logoUrl" defaultValue={str(portal.logoUrl)} placeholder="https://" data-testid="sequence-logo" /></label>
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
      {canEdit ? <p><a className="pill outline" href={`/api/hearts/export-app?portal=${encodeURIComponent(portal.slug)}`} data-testid="export-app">{SEQUENCE_COPY.export}</a></p> : null}
    </AdminFrame>
  )
}

export async function SequenceOverview(ctx: Ctx) {
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
  const { portal, base } = ctx
  const map = featuresOf(portal)
  const kinetic = kineticMomentsOn(portal)
  const next = `${base}/admin/features`
  return (
    <AdminFrame ctx={ctx} active="features" title="Features" intro="Switch parts on or off for this course. Saving happens straight away." testId="sequence-features" showOnPhone>
      <form className="form-stack panel" action="/api/hearts" method="post" data-testid="sequence-features-form">
        <Hidden fields={{ action: 'sequence-features', portalSlug: portal.slug, next }} />
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
        <form className="form-stack panel" action="/api/hearts" method="post" data-testid="sequence-code-form">
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

export async function SequenceLearners(ctx: Ctx) {
  const { payload, portal, base } = ctx
  const people = await portalPeople(payload, portal.id)
  const learners = people.filter((person) => person.role === 'learner')
  const courses = await rows(payload, 'courses', { and: [{ origin: { equals: 'local' } }, { portal: { equals: portal.id } }, { hidden: { not_equals: true } }] }, { sort: 'title' })
  const here = `${base}/admin/teach`
  return (
    <AdminFrame ctx={ctx} active="teach" title="Learners" intro="People in this course." testId="sequence-learners" showOnPhone>
      <section className="panel" data-testid="give-course-panel">
        <header><div><h2>Give this course</h2><p>Search by name, then tick who should have it.</p></div></header>
        <div className="body">
          <GiveCourse
            learners={learners.map((learner) => ({ id: learner.id, name: str(learner.name) || 'Learner' }))}
            courses={courses.map((course) => ({ id: course.id, title: str(course.title), door: 'Films' }))}
            next={here}
          />
        </div>
      </section>
      {learners.length ? (
        <ul data-testid="sequence-learner-list">
          {learners.map((learner) => <li key={learner.id} data-testid="sequence-learner">{str(learner.name)}</li>)}
        </ul>
      ) : <p data-testid="sequence-empty-learners">No learners yet.</p>}
    </AdminFrame>
  )
}
