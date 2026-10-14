import { Hidden } from '@/components/app/shell'
import { HelpTip } from '@/components/desk/help'
import { TOOL } from '@/lib/desk-help'
import { ExampleInUse } from '@/components/app/care'
import { DeleteInline, DeleteMany, DeletePick } from '@/components/desk/delete-controls'
import { REPORT_LABEL, announceAudienceLabel, plainAlertSource, plainReportStatus, plainTarget } from '@/lib/safety'
import { safeguardingLead } from '@/lib/portal-contacts'
import { canSeeAlertContent } from '@/lib/safety'
import { loadQueue, targetLearner } from '@/server/safety'
import { idOf } from '@/lib/ids'
import { shortDate, str, type Ctx } from '../common'
import { AdminFrame } from './overview'
import { DeskFrame, masterNav } from './shell'
import type { SessionUser } from '@/server/context'
import type { Payload } from 'payload'

const GOLD = { border: '2px solid #D4A84B', borderRadius: 16, padding: 16, background: '#163633' }

function personName(value: unknown) {
  if (value && typeof value === 'object' && 'name' in value) return String((value as { name?: string }).name || 'A person')
  return 'A person'
}

export async function CareSafetyBody({
  payload,
  user,
  portalId,
  here,
  slug,
}: {
  payload: Payload
  user: SessionUser
  portalId: number | null
  here: string
  slug?: string
}) {
  const queue = await loadQueue(payload, portalId)
  const authors = new Map<number, number | null>()
  for (const report of queue.reports) {
    authors.set(report.id, await targetLearner(payload, str(report.targetType), Number(report.targetId)))
  }
  const lead = portalId ? await safeguardingLead(payload, portalId) : null
  const leadUser = lead?.email
    ? ((await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 1, where: { email: { equals: lead.email } } })).docs[0] as { id: number } | undefined)
    : null
  const showAlert = (alert: Record<string, unknown>) => canSeeAlertContent(user, leadUser?.id || null)
  return (
    <div id="care-queue">
      {portalId && !lead ? (
        <div className="flash notice" data-testid="add-safeguarding-lead">
          Name the person who will reach out when someone may need support. Until then, portal admins and the master are told. <a href={slug ? `/p/${slug}/admin/settings` : here}>Open portal settings</a>
        </div>
      ) : null}
      <section className="panel" style={{ marginBottom: 18, ...GOLD }} data-testid="needs-a-person">
        <header className="light">
          <h2>Needs a person</h2>
          <HelpTip topic="safeguarding">{TOOL.safeguarding}</HelpTip>
        </header>
        <div className="body">
          {queue.alerts.length ? queue.alerts.map((alert) => (
            <article key={alert.id} className="lib-card" data-testid="safeguard-alert" data-source={str(alert.source)}>
              <p><b>A learner may need support</b></p>
              {showAlert(alert) ? (
                <>
                  <p className="hint">{personName(alert.learner)} · {plainAlertSource(str(alert.source))} · {shortDate(str(alert.createdAt))}</p>
                  {alert.outcome ? <p data-testid="safeguard-outcome">Note: {str(alert.outcome)}</p> : (
                    <form className="form" action="/api/hearts" method="post">
                      <Hidden fields={{ action: 'safety-outcome', alert: alert.id, portal: portalId || idOf((alert as { portal?: unknown }).portal) || '', next: here }} />
                      <label className="stack">What you did<textarea name="outcome" rows={2} required placeholder="Who you spoke with, and what happens next" data-testid="safeguard-outcome-text" /></label>
                      <button className="btn gold small" type="submit" data-testid="safeguard-outcome-save">Save note</button>
                    </form>
                  )}
                </>
              ) : (
                <p className="hint">An alert is waiting for the named person. You do not need the details.</p>
              )}
            </article>
          )) : (
            <ExampleInUse
              desk
              testId="safety-example-person"
              title="A learner may need support"
              action={slug ? { href: `/p/${slug}/admin/settings`, label: 'Name who will reach out' } : { href: '/master', label: 'Open a portal' }}
            >
              <p>Yusuf · Their words need a person · today</p>
              <p className="hint">A named person is asked to look today, then writes here what they did.</p>
            </ExampleInUse>
          )}
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 18 }} data-testid="moderation-queue">
        <header className="light"><h2>Raised with you</h2></header>
        <div className="body" style={{ display: 'grid', gap: 14 }}>
          {queue.reports.map((report) => {
            const portal = portalId || idOf((report as { portal?: unknown }).portal)
            const person = authors.get(report.id) || ''
            return (
              <article key={report.id} className="lib-card" data-testid="report-row" data-status={str(report.status)}>
                <p><b>{REPORT_LABEL[str(report.reason) as keyof typeof REPORT_LABEL] || 'A concern'}</b> · {plainTarget(str(report.targetType))} · {shortDate(str(report.createdAt))}</p>
                {report.note ? <p>{str(report.note)}</p> : null}
                <p className="hint">{plainReportStatus(str(report.status))}</p>
                <div className="actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <form action="/api/hearts" method="post">
                    <Hidden fields={{ action: 'safety-hide', report: report.id, targetType: str(report.targetType), targetId: String(report.targetId), portal: portal || '', next: here }} />
                    <button className="btn ghost small" type="submit" data-testid="mod-hide">Hide</button>
                  </form>
                  <form action="/api/hearts" method="post">
                    <Hidden fields={{ action: 'safety-keep', report: report.id, targetType: str(report.targetType), targetId: String(report.targetId), portal: portal || '', next: here }} />
                    <button className="btn teal small" type="submit" data-testid="mod-keep">Keep</button>
                  </form>
                  {person ? (
                    <form action="/api/hearts" method="post">
                      <Hidden fields={{ action: 'safety-mute', portal: portal || '', person, next: here }} />
                      <button className="btn ghost small" type="submit" data-testid="mod-mute">Quiet for 7 days</button>
                    </form>
                  ) : null}
                </div>
                {person ? (
                  <form className="form" action="/api/hearts" method="post" style={{ marginTop: 8 }}>
                    <Hidden fields={{ action: 'safety-message', portal: portal || '', person, next: here }} />
                    <label className="stack">Message the person<textarea name="body" rows={2} required placeholder="A short, kind note they will see" data-testid="mod-message" /></label>
                    <button className="btn ink small" type="submit" data-testid="mod-message-send">Send a note</button>
                  </form>
                ) : null}
              </article>
            )
          })}
          {!queue.reports.length ? (
            <ExampleInUse
              desk
              testId="safety-example-report"
              title="Someone may be at risk"
              action={slug ? { href: `/p/${slug}/admin/teach`, label: 'Open shared answers' } : { href: '/master/learners', label: 'See learners' }}
            >
              <p>A written answer · today</p>
              <p>They wrote that they do not feel safe at home.</p>
              <p className="hint">Waiting for you. Hide it, keep it, or send a kind note. The writer is not told who looked.</p>
            </ExampleInUse>
          ) : null}
        </div>
      </section>

      <section className="panel" data-testid="screened-items">
        <header className="light"><h2>Held for a check</h2></header>
        <div className="body">
          {queue.hides.map((hide) => (
            <article key={hide.id} className="lib-card" data-testid="hidden-row">
              <p>{plainTarget(str(hide.targetType))} · {str(hide.reason) === 'Needs a person.' ? 'Needs a person' : str(hide.reason) || 'Held for a check'}</p>
              <form action="/api/hearts" method="post">
                <Hidden fields={{ action: 'safety-keep', targetType: str(hide.targetType), targetId: String(hide.targetId), portal: portalId || idOf((hide as { portal?: unknown }).portal) || '', next: here }} />
                <button className="btn teal small" type="submit" data-testid="screen-keep">Keep visible</button>
              </form>
            </article>
          ))}
          {!queue.hides.length ? (
            <ExampleInUse
              desk
              testId="safety-example-held"
              title="Held for a check"
              action={slug ? { href: `/p/${slug}/admin/teach`, label: 'Open shared answers' } : { href: '/master/review/swarm', label: 'Review hidden answers' }}
            >
              <p>A circle answer · unkind words</p>
              <p className="hint">It stays hidden until you choose to keep it visible.</p>
            </ExampleInUse>
          ) : null}
        </div>
      </section>
    </div>
  )
}

export async function PortalSafetyScreen(ctx: Ctx) {
  const here = `${ctx.base}/admin/safety`
  return (
    <AdminFrame ctx={ctx} active="safety" title="Care and safety" intro="When someone may need support, a named person is asked to look today and to reach out. Concerns people raise sit here, for this portal only." testId="admin-safety">
      {await CareSafetyBody({ payload: ctx.payload, user: ctx.user, portalId: ctx.portal.id, here, slug: String(ctx.portal.slug || '') })}
    </AdminFrame>
  )
}

export async function MasterSafetyScreen({ payload, user, query }: { payload: Payload; user: SessionUser; query: { error?: string; notice?: string } }) {
  return (
    <DeskFrame payload={payload} user={user} title="Care and safety" intro="When someone may need support, a named person is asked to look today. This is every portal." active="safety" nav={masterNav()} brand="HEARTS" subBrand="Master desk" brandHref="/master" query={query} testId="master-safety">
      {await CareSafetyBody({ payload, user, portalId: null, here: '/master/safety' })}
    </DeskFrame>
  )
}

export async function PortalAnnounceScreen(ctx: Ctx) {
  const here = `${ctx.base}/admin/announcements`
  const list = await ctx.payload.find({ collection: 'announcements', overrideAccess: true, depth: 0, limit: 40, sort: '-createdAt', where: { portal: { equals: ctx.portal.id } } })
  const codes = await ctx.payload.find({ collection: 'access-codes', overrideAccess: true, depth: 0, limit: 40, where: { portal: { equals: ctx.portal.id } } })
  return (
    <AdminFrame ctx={ctx} active="announcements" title="Announcements" intro="A short note for everyone, for teachers, or for one code. It appears on Home until they dismiss it." testId="admin-announcements">
      <AnnounceForm portal={ctx.portal.id} here={here} codes={codes.docs as { id: number; label?: string; code?: string }[]} />
      <AnnounceList rows={list.docs as { id: number; body?: string; audience?: string; createdAt?: string; portal?: unknown }[]} next={here} portalSlug={ctx.portal.slug} />
    </AdminFrame>
  )
}

export async function MasterAnnounceScreen({ payload, user, query }: { payload: Payload; user: SessionUser; query: { error?: string; notice?: string } }) {
  const portals = await payload.find({ collection: 'portals', overrideAccess: true, depth: 0, limit: 40, sort: 'name' })
  const list = await payload.find({ collection: 'announcements', overrideAccess: true, depth: 0, limit: 40, sort: '-createdAt' })
  return (
    <DeskFrame payload={payload} user={user} title="Announcements" intro="A short note to a portal. Learners see it on Home." active="announcements" nav={masterNav()} brand="HEARTS" subBrand="Master desk" brandHref="/master" query={query} testId="master-announcements">
      <AnnounceForm portal={Number(portals.docs[0]?.id || 0)} here="/master/announcements" portals={portals.docs as { id: number; name?: string }[]} codes={[]} />
      <AnnounceList rows={list.docs as { id: number; body?: string; audience?: string; createdAt?: string }[]} next="/master/announcements" />
    </DeskFrame>
  )
}

function AnnounceForm({ portal, here, codes, portals }: { portal: number; here: string; codes: { id: number; label?: string; code?: string }[]; portals?: { id: number; name?: string }[] }) {
  return (
    <section className="panel" style={{ marginBottom: 18 }}>
      <header className="light"><h2>Write a note</h2></header>
      <form id="write-a-note" className="form body" action="/api/hearts" method="post" data-testid="announce-form">
        <Hidden fields={{ action: 'announce', next: here, portal: portals ? undefined : portal }} />
        {portals ? (
          <label className="stack">Portal
            <select name="portal" defaultValue={portal} data-testid="announce-portal">
              {portals.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </label>
        ) : null}
        <label className="stack">Message
          <textarea name="body" rows={4} maxLength={500} required placeholder="A short note, in ordinary words" data-testid="announce-body" />
        </label>
        <label className="stack">Who should see it
          <select name="audience" data-testid="announce-audience">
            <option value="everyone">Everyone in the portal</option>
            <option value="teachers">Teachers only</option>
            <option value="code">One access code</option>
          </select>
        </label>
        {codes.length ? (
          <label className="stack">Access code
            <select name="code" data-testid="announce-code">
              {codes.map((row) => <option key={row.id} value={row.id}>{row.label || row.code}</option>)}
            </select>
          </label>
        ) : null}
        <label className="stack">Show from (optional)
          <input type="datetime-local" name="publishAt" data-testid="announce-when" />
        </label>
        <button className="btn gold" type="submit" data-testid="announce-submit">Share this note</button>
      </form>
    </section>
  )
}

function AnnounceList({ rows, next, portalSlug }: { rows: { id: number; body?: string; audience?: string; createdAt?: string }[]; next: string; portalSlug?: string }) {
  return (
    <section className="panel" data-testid="announce-list">
      <header className="light"><h2>Sent and waiting</h2></header>
      <DeleteMany kind="announcement" next={next} portalSlug={portalSlug} formId="bulk-announcement" />
      <div className="body">
        {rows.map((row) => (
          <article key={row.id} className="lib-card" data-testid="announce-row">
            <p>{row.body}</p>
            <p className="hint">{announceAudienceLabel(String(row.audience || 'everyone'))} · {shortDate(row.createdAt)}</p>
            <DeletePick formId="bulk-announcement" id={row.id} label={String(row.body || 'announcement').slice(0, 80)} />
            <DeleteInline kind="announcement" id={row.id} next={next} portalSlug={portalSlug} testId={`delete-announcement-${row.id}`} />
          </article>
        ))}
        {!rows.length ? (
          <ExampleInUse desk testId="announce-example" title="A note on Home" action={{ href: '#write-a-note', label: 'Write a note' }}>
            <p>Circle after Isha is in the hall tonight. Come if you can.</p>
            <p className="hint">Everyone in the portal · today</p>
          </ExampleInUse>
        ) : null}
      </div>
    </section>
  )
}
