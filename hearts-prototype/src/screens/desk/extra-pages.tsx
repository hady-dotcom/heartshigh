import Link from 'next/link'
import { ExampleInUse } from '@/components/app/care'
import { Hidden } from '@/components/app/shell'
import { LibraryCoursePicker } from '@/components/desk/library-picker'
import { CodeLimits, CodeStatus } from '@/components/desk/codes'
import { loadLibraryPicker } from '@/server/code-courses'
import type { Payload } from 'payload'
import { ShareLinks } from '@/components/desk/share-links'
import { Qr } from '@/components/qr'
import type { SessionUser } from '@/server/context'
import { ref, rows, shortDate, str } from '../common'
import { DeskFrame, masterNav } from './shell'
import { DeleteInline, DeleteMany, DeletePick } from '@/components/desk/delete-controls'

export { MasterLearners, MasterPlans } from './learner-desk'

type MasterCtx = { payload: Payload; user: SessionUser; query: { error?: string; notice?: string }; origin?: string }

function Frame({ ctx, active, title, intro, testId, showOnPhone, primary, children }: { ctx: MasterCtx; active: string; title: string; intro: string; testId: string; showOnPhone?: boolean; primary?: { label: string; href: string }; children: React.ReactNode }) {
  return (
    <DeskFrame payload={ctx.payload} user={ctx.user} title={title} intro={intro} active={active} nav={masterNav()} brand="HEARTS" subBrand="Master desk" brandHref="/master" query={ctx.query} testId={testId} showOnPhone={showOnPhone} primary={primary}>
      {children}
    </DeskFrame>
  )
}

export async function MasterCodes(ctx: MasterCtx) {
  const [codes, portals, library] = await Promise.all([
    rows(ctx.payload, 'access-codes', undefined, { sort: 'code', limit: 1000 }),
    rows(ctx.payload, 'portals', undefined, { sort: 'name' }),
    loadLibraryPicker(ctx.payload),
  ])
  const origin = (ctx.origin || '').replace(/\/$/, '')
  return (
    <Frame ctx={ctx} active="codes" title="Codes" intro="Join codes for every portal. Send the link rather than the code, so nobody has to type it. Demo codes change when the demo is reset." testId="master-codes-page" showOnPhone>
      <section className="panel">
        <DeleteMany kind="code" next="/master/codes" formId="bulk-code" />
        <div className="table-wrap">
          <table className="data master-codes-table" data-testid="master-codes">
            <thead><tr><th>Portal</th><th>Code</th><th>Label</th><th>For</th><th>Works</th><th>Link to send</th></tr></thead>
            <tbody>
              {codes.map((code) => {
                const portal = portals.find((row) => row.id === ref(code.portal))
                const slug = str(portal?.slug)
                const share = `${origin}/join?code=${encodeURIComponent(str(code.code))}`
                return (
                  <tr key={code.id} data-testid="master-code-row">
                    <td data-label="Portal">{str(portal?.name)}</td>
                    <td data-label="Code" data-testid="code-value" style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>{str(code.code)}</td>
                    <td data-label="Label">{str(code.label)}</td>
                    <td data-label="For">{str(code.role)}</td>
                    <td data-label="Works"><CodeStatus code={code} next="/master/codes" /></td>
                    <td data-label="Link to send" className="link-to-send">
                      <div className="address" data-testid="share-url">{share}</div>
                      <div className="link-to-send-tools">
                        <ShareLinks value={share} testId="code-copy" />
                        <div className="qr-small"><Qr value={share} testId="code-qr" /></div>
                      </div>
                      {slug ? <Link className="btn ghost small" href={`/p/${slug}/admin/access`} data-testid="change-pack">Change courses</Link> : null}
                      <DeletePick formId="bulk-code" id={code.id} label={str(code.code)} />
                      <DeleteInline kind="code" id={code.id} next="/master/codes" testId={`delete-code-${code.id}`} />
                    </td>
                  </tr>
                )
              })}
              {!codes.length ? <tr><td colSpan={6} className="empty">No codes yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel" id="new-code">
        <header><div><h2>New access code</h2><p>Tick the library courses this code can open. A whole door is there when courses are tagged.</p></div></header>
        <form className="body form" action="/api/hearts" method="post">
          <Hidden fields={{ action: 'create-code', next: '/master/codes' }} />
          <div className="cols">
            <label className="stack">Portal
              <select name="portalSlug" data-testid="master-new-code-portal">{portals.map((portal) => <option key={portal.id} value={str(portal.slug)}>{portalDisplayName(portal)}</option>)}</select>
            </label>
            <label className="stack">Code<input type="text" data-testid="master-new-code" name="code" placeholder="Leave empty for a random code" /></label>
          </div>
          <div className="cols">
            <label className="stack">Label<input type="text" data-testid="master-new-code-label" name="label" placeholder="A name you will recognise" /></label>
            <label className="stack">For
              <select data-testid="master-new-code-role" name="role" defaultValue="learner">
                <option value="learner">Learner</option><option value="teacher">Teacher</option><option value="admin">Admin</option><option value="parent">Parent (one course)</option>
              </select>
            </label>
          </div>
          <label className="stack">Teacher code
            <select data-testid="master-new-code-teacher" name="linkedTeacherCode">
              <option value="">None</option>
              {codes.filter((code) => code.role === 'teacher').map((code) => {
                const portal = portals.find((row) => row.id === ref(code.portal))
                return <option key={code.id} value={code.id}>{str(code.code)}{portal ? ` · ${portalDisplayName(portal)}` : ''}</option>
              })}
            </select>
          </label>
          <LibraryCoursePicker courses={library} testId="master-new-code-courses" />
          <CodeLimits />
          <div className="actions"><button className="btn ink" data-testid="master-new-code-submit" type="submit">Create access code</button></div>
        </form>
      </section>
    </Frame>
  )
}

export async function MasterNights(ctx: MasterCtx) {
  const [events, portals] = await Promise.all([
    rows(ctx.payload, 'events', undefined, { sort: 'startsAt', limit: 80 }),
    rows(ctx.payload, 'portals', undefined, { sort: 'name', limit: 1 }),
  ])
  const slug = str(portals[0]?.slug)
  return (
    <Frame ctx={ctx} active="nights" title="Live in person" intro="Nights and gatherings across the portals." testId="master-nights" primary={slug ? { label: 'Plan a night', href: `/p/${slug}/admin/nights` } : undefined}>
      <section className="panel">
        <DeleteMany kind="night" next="/master/nights" formId="bulk-night" />
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Night</th><th>When</th><th>Place</th></tr></thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} data-testid="master-night-row">
                  <td>{str(event.title)} <DeletePick formId="bulk-night" id={event.id} label={str(event.title)} /></td>
                  <td>{shortDate(str(event.startsAt))}</td>
                  <td>{str(event.place)} <DeleteInline kind="night" id={event.id} next="/master/nights" testId={`delete-night-${event.id}`} /></td>
                </tr>
              ))}
              {!events.length ? <tr><td colSpan={3}><ExampleInUse desk title="Circle after Isha" action={{ href: '/master/live', label: 'See Live recordings' }}><p>East London · the hall · Thursday</p></ExampleInUse></td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </Frame>
  )
}

export async function MasterFraming(ctx: MasterCtx) {
  return (
    <Frame ctx={ctx} active="framing" title="Framing director" intro="How a clip is framed on the phone. The split player is registered; talk words stay as the sheikh said them." testId="framing-desk">
      <section className="panel">
        <div className="body">
          <p>Learners see one crop: the wide video in a band at the top, and the words underneath. Other crops are experiments and are not on the phone.</p>
          <p>That choice never rewrites the talk.</p>
          <p><Link className="btn" href="/master/experiments">Open the Experiments desk</Link></p>
        </div>
      </section>
    </Frame>
  )
}
