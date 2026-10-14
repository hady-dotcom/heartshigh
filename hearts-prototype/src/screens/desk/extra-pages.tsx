import Link from 'next/link'
import { ExampleInUse } from '@/components/app/care'
import type { Payload } from 'payload'
import { ShareLinks } from '@/components/desk/share-links'
import { Qr } from '@/components/qr'
import type { SessionUser } from '@/server/context'
import { CodeStatus } from '@/components/desk/codes'
import { ref, rows, shortDate, str } from '../common'
import { DeskFrame, masterNav } from './shell'

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
  const [codes, portals] = await Promise.all([
    rows(ctx.payload, 'access-codes', undefined, { sort: 'code', limit: 1000 }),
    rows(ctx.payload, 'portals', undefined, { sort: 'name' }),
  ])
  const origin = (ctx.origin || '').replace(/\/$/, '')
  return (
    <Frame ctx={ctx} active="codes" title="Codes" intro="Join codes for every portal. Send the link rather than the code, so nobody has to type it. Demo codes change when the demo is reset." testId="master-codes-page" showOnPhone>
      <section className="panel">
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
                      {slug ? <Link className="btn ghost small" href={`/p/${slug}/admin/access`} data-testid="change-pack">Change pack</Link> : null}
                    </td>
                  </tr>
                )
              })}
              {!codes.length ? <tr><td colSpan={6} className="empty">No codes yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
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
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Night</th><th>When</th><th>Place</th></tr></thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{str(event.title)}</td>
                  <td>{shortDate(str(event.startsAt))}</td>
                  <td>{str(event.place)}</td>
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
