import { AdminFrame } from '@/screens/desk/overview'
import { Flash, Hidden } from '@/components/app/shell'
import { SequenceList } from '@/components/desk/sequence-list'
import { SEQUENCE_COPY } from '@/lib/sequence'
import { sortParts } from '@/lib/part-order'
import { rows, str, type Ctx } from '../common'

export async function SequenceDesk(ctx: Ctx) {
  const { payload, portal, base, query, user } = ctx
  const courses = await rows(payload, 'courses', { and: [{ origin: { equals: 'local' } }, { portal: { equals: portal.id } }, { hidden: { not_equals: true } }] }, { sort: 'createdAt', limit: 5 })
  const course = courses[0]
  const lessonRows = course ? await rows(payload, 'lessons', { course: { equals: course.id } }, { sort: 'order' }) : []
  const lessons = sortParts(lessonRows, () => 0)
  const canEdit = user.role === 'master' || user.role === 'portal-admin'
  const next = `${base}/admin/sequence`
  return (
    <AdminFrame ctx={ctx} active="sequence" title="Course films" intro="Add films in the order people should watch them. Drag a row, or use Move up and Move down. Titles can be changed." testId="sequence-desk" showOnPhone>
      <Flash error={query.error} notice={query.notice} />
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
        <form className="form-stack panel" action="/api/hearts" method="post" data-testid="sequence-settings-form">
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
