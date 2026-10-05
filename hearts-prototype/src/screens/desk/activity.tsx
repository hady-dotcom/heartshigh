import { BritishDateFields } from '@/components/desk/british-date'
import { HelpTip } from '@/components/desk/help'
import { auditSentence } from '@/lib/audit-events'
import { TOOL } from '@/lib/desk-help'
import { idOf } from '@/lib/ids'
import { dateKeyInZone, DEFAULT_TIME_ZONE, portalTimeZone, staffWhen, ymdFromParts, zonedDayRange } from '@/lib/zone-time'
import type { Ctx } from '../common'
import { ref, rows, str } from '../common'
import { AdminFrame } from './overview'
import { MasterFrame, type MasterCtx } from './master'

type AuditRow = {
  id: number
  event?: string
  actor?: { id?: number; name?: string; email?: string; role?: string } | number | null
  actorRole?: string | null
  target?: { id?: number; name?: string; email?: string } | number | null
  portal?: { id?: number; name?: string } | number | null
  reason?: string | null
  at?: string
  detail?: Record<string, unknown> | null
}

function personName(value: AuditRow['actor'] | AuditRow['target']) {
  if (!value || typeof value === 'number') return ''
  return value.name || value.email || ''
}

function groupByDay(list: AuditRow[], timeZone: string) {
  const groups = new Map<string, AuditRow[]>()
  for (const row of list) {
    const key = row.at ? dateKeyInZone(new Date(row.at), timeZone) : 'unknown'
    const bucket = groups.get(key) || []
    bucket.push(row)
    groups.set(key, bucket)
  }
  return [...groups.entries()].map(([day, items]) => ({
    day,
    label: staffWhen(`${day}T12:00:00.000Z`, timeZone).replace(/,.*/, '') || day,
    items,
  }))
}

function ActivityBody({
  rows: list,
  timeZone,
  here,
  portalSlug,
  people,
  events,
  query,
}: {
  rows: AuditRow[]
  timeZone: string
  here: string
  portalSlug?: string
  people: { id: number; name?: string | null; email?: string }[]
  events: string[]
  query: { person?: string; action?: string; from?: string; to?: string }
}) {
  const grouped = groupByDay(list, timeZone)
  const exportHref = `/api/hearts/audit.csv?${new URLSearchParams({
    portal: portalSlug || '',
    person: query.person || '',
    action: query.action || '',
    from: query.from || '',
    to: query.to || '',
  }).toString()}`
  return (
    <>
      <section className="panel" style={{ marginBottom: 18 }} data-testid="activity-filters">
        <header>
          <div>
            <h2>Find a change <HelpTip topic="activity-filters">{TOOL.activityFilters}</HelpTip></h2>
            <p data-testid="activity-zone">Times are in {timeZone.replace(/_/g, ' ')}. Dates are written the British way.</p>
          </div>
        </header>
        <form className="body form" method="get" action={here} data-testid="activity-filter-form">
          <div className="cols">
            <label className="stack">Person
              <select name="person" defaultValue={query.person || ''} data-testid="activity-person">
                <option value="">Anyone</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>{person.name || person.email}</option>
                ))}
              </select>
            </label>
            <label className="stack">Action
              <select name="action" defaultValue={query.action || ''} data-testid="activity-action">
                <option value="">All actions</option>
                {events.map((event) => <option key={event} value={event}>{event.replace(/[._]/g, ' ')}</option>)}
              </select>
            </label>
          </div>
          <div className="cols">
            <label className="stack" lang="en-GB">From
              <BritishDateFields name="from" value={query.from} testId="activity-from" />
            </label>
            <label className="stack" lang="en-GB">To
              <BritishDateFields name="to" value={query.to} testId="activity-to" />
            </label>
          </div>
          <div className="actions">
            <button className="btn ink small" type="submit">Show</button>
            {list.length ? (
              <a className="btn ghost small" href={exportHref} data-testid="activity-export">Download CSV <HelpTip topic="activity-export">{TOOL.activityExport}</HelpTip></a>
            ) : (
              <span className="btn ghost small" aria-disabled="true" data-testid="activity-export" title="Nothing to download yet">Download CSV</span>
            )}
          </div>
        </form>
      </section>
      <section className="panel" data-testid="activity-log">
        <header>
          <div>
            <h2>Activity ({list.length})</h2>
            <p>{grouped.length} day{grouped.length === 1 ? '' : 's'} in this view.</p>
          </div>
        </header>
        <div className="body" style={{ display: 'grid', gap: 18 }}>
          {grouped.map((group) => (
            <details key={group.day} open data-testid="activity-day" data-day={group.day}>
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{group.label} · {group.items.length}</summary>
              <div className="table-wrap" style={{ marginTop: 10 }}>
                <table className="data">
                  <thead><tr><th>When</th><th>What happened</th></tr></thead>
                  <tbody>
                    {group.items.map((row) => (
                      <tr key={row.id} data-testid="activity-row" data-event={row.event}>
                        <td data-testid="activity-when" data-at={str(row.at)} style={{ whiteSpace: 'nowrap' }}>{staffWhen(str(row.at), timeZone)}</td>
                        <td data-testid="activity-sentence">
                          {auditSentence({
                            event: String(row.event || ''),
                            actorName: personName(row.actor),
                            actorRole: row.actorRole || (typeof row.actor === 'object' ? row.actor?.role : ''),
                            targetName: personName(row.target),
                            portalName: typeof row.portal === 'object' ? row.portal?.name : '',
                            reason: row.reason,
                            detail: row.detail,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
          {!list.length ? <p className="empty">Nothing in this view yet.</p> : null}
        </div>
      </section>
    </>
  )
}

function activityFilters(query: Record<string, string | undefined>) {
  const from = ymdFromParts(query.fromYear, query.fromMonth, query.fromDay) || query.from || ''
  const to = ymdFromParts(query.toYear, query.toMonth, query.toDay) || query.to || ''
  return { person: query.learner || query.person || '', action: query.action || '', from, to }
}

async function loadActivity(payload: Ctx['payload'], portalId: number | null, query: { person?: string; action?: string; from?: string; to?: string }, timeZone: string) {
  const where: Record<string, unknown>[] = []
  if (portalId) where.push({ portal: { equals: portalId } })
  if (query.person) {
    const id = Number(query.person)
    where.push({ or: [{ actor: { equals: id } }, { target: { equals: id } }] })
  }
  if (query.action) where.push({ event: { equals: query.action } })
  const from = query.from ? zonedDayRange(query.from, timeZone) : null
  const to = query.to ? zonedDayRange(query.to, timeZone) : null
  if (from) where.push({ at: { greater_than_equal: from.from } })
  if (to) where.push({ at: { less_than_equal: to.to } })
  const found = await rows(payload, 'audit-log', where.length ? { and: where } : undefined, { depth: 1, sort: '-at', limit: 200 })
  return found as unknown as AuditRow[]
}

export async function PortalActivityScreen(ctx: Ctx) {
  const { payload, portal, base, query } = ctx
  const timeZone = portalTimeZone(portal)
  const filters = activityFilters(query as Record<string, string | undefined>)
  const [list, people] = await Promise.all([
    loadActivity(payload, portal.id, filters, timeZone),
    rows(payload, 'users', { 'tenants.tenant': { equals: portal.id } }, { limit: 300, sort: 'name' }),
  ])
  const events = [...new Set(list.map((row) => String(row.event || '')).filter(Boolean))].sort()
  return (
    <AdminFrame ctx={ctx} active="activity" title="Activity log" intro="Who changed a person, a code, a class or a setting in this portal." testId="admin-activity">
      <ActivityBody
        rows={list}
        timeZone={timeZone}
        here={`${base}/admin/activity`}
        portalSlug={portal.slug}
        people={people.map((person) => ({ id: person.id, name: str(person.name), email: str(person.email) }))}
        events={events}
        query={filters}
      />
    </AdminFrame>
  )
}

export async function MasterActivityScreen(ctx: MasterCtx) {
  const raw = ctx.query as Record<string, string | undefined>
  const filters = activityFilters(raw)
  let portalId: number | null = null
  let timeZone = DEFAULT_TIME_ZONE
  if (raw.portal) {
    const found = await rows(ctx.payload, 'portals', { slug: { equals: raw.portal } }, { limit: 1 })
    portalId = found[0]?.id || null
    if (found[0]) timeZone = portalTimeZone(found[0])
  }
  const [list, people, portals] = await Promise.all([
    loadActivity(ctx.payload, portalId, filters, timeZone),
    rows(ctx.payload, 'users', undefined, { limit: 400, sort: 'name' }),
    rows(ctx.payload, 'portals', undefined, { sort: 'name' }),
  ])
  const events = [...new Set(list.map((row) => String(row.event || '')).filter(Boolean))].sort()
  return (
    <MasterFrame ctx={ctx} active="activity" title="Activity log" intro="Every staff change across the portals. Portal admins only see their own community." testId="master-activity">
      <form method="get" action="/master/activity" className="form" style={{ marginBottom: 16 }}>
        <label className="stack">Portal
          <select name="portal" defaultValue={raw.portal || ''} data-testid="activity-portal">
            <option value="">All portals</option>
            {portals.map((portal) => <option key={portal.id} value={str(portal.slug)}>{str(portal.name)}</option>)}
          </select>
        </label>
        <button className="btn ghost small" type="submit">Show this portal</button>
      </form>
      <ActivityBody
        rows={list}
        timeZone={timeZone}
        here="/master/activity"
        people={people.filter((person) => person.role !== 'master').map((person) => ({ id: person.id, name: str(person.name), email: str(person.email) }))}
        events={events}
        query={filters}
      />
    </MasterFrame>
  )
}

export function activityPortalId(row: AuditRow) {
  return idOf(row.portal) || ref(row.portal)
}
