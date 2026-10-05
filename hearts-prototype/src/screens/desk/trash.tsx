import { Hidden } from '@/components/app/shell'
import { HelpTip } from '@/components/desk/help'
import { TOOL } from '@/lib/desk-help'
import { TRASH_KEEP_DAYS } from '@/lib/trash'
import { DEFAULT_TIME_ZONE, portalTimeZone, staffWhen } from '@/lib/zone-time'
import { listTrash, trashGroups } from '@/server/trash'
import type { Ctx } from '../common'
import { rows, str } from '../common'
import { AdminFrame } from './overview'
import { MasterFrame, type MasterCtx } from './master'

function TrashBody({
  items,
  here,
  portalSlug,
  timeZone,
  master,
}: {
  items: Awaited<ReturnType<typeof listTrash>>
  here: string
  portalSlug?: string
  timeZone: string
  master?: boolean
}) {
  const groups = trashGroups(items)
  const total = items.length
  return (
    <>
      <section className="panel" style={{ marginBottom: 18 }} data-testid="trash-summary">
        <header>
          <div>
            <h2>Recently removed ({total}) <HelpTip topic="trash">{TOOL.trashRestore}</HelpTip></h2>
            <p>These stay for {TRASH_KEEP_DAYS} days, then a nightly job empties them for good. People and their answers are never kept here.</p>
          </div>
        </header>
        <div className="body">
          {groups.length ? (
            <p className="hint" data-testid="trash-counts">
              {groups.map((group) => `${group.label} ${group.count}`).join(' · ')}
            </p>
          ) : (
            <p className="empty" data-testid="trash-empty">Nothing is waiting here.</p>
          )}
        </div>
      </section>
      {groups.map((group) => (
        <section key={group.slug} className="panel" style={{ marginBottom: 18 }} data-testid="trash-group" data-collection={group.slug}>
          <header>
            <div>
              <h2>{group.label} ({group.count})</h2>
              <p>Restore puts one item back. Empty now removes the whole group for good.</p>
            </div>
          </header>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Name</th><th>Removed</th><th>Days left</th><th /></tr></thead>
              <tbody>
                {group.items.map((item) => (
                  <tr key={`${item.collection}-${item.id}`} data-testid="trash-row" data-collection={item.collection} data-id={item.id}>
                    <td>{item.title}</td>
                    <td>{item.deletedAt ? staffWhen(item.deletedAt, timeZone) : '—'}</td>
                    <td data-testid="trash-days-left">{item.daysLeft === 0 ? 'Due' : `${item.daysLeft} day${item.daysLeft === 1 ? '' : 's'}`}</td>
                    <td>
                      <form action="/api/hearts" method="post">
                        <Hidden fields={{ action: 'trash-restore', collection: item.collection, id: item.id, portalSlug: portalSlug || '', next: here }} />
                        <button className="btn teal small" type="submit" data-testid="trash-restore">Restore</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form className="form" action="/api/hearts" method="post" style={{ margin: 16 }}>
            <Hidden fields={{ action: 'trash-empty', collection: group.slug, portalSlug: portalSlug || '', next: here }} />
            <label className="stack">Type yes to empty {group.label.toLowerCase()}
              <input name="confirm" autoComplete="off" data-testid="trash-empty-confirm" />
            </label>
            <div className="actions">
              <button className="btn danger small" type="submit" data-testid="trash-empty">Empty {group.label.toLowerCase()} now <HelpTip topic="trash-empty">{TOOL.trashEmpty}</HelpTip></button>
            </div>
          </form>
        </section>
      ))}
      {master && total ? (
        <section className="panel" data-testid="trash-empty-all">
          <header><div><h2>Empty everything</h2><p>Only the master desk can clear every portal’s Recently removed at once.</p></div></header>
          <form className="body form" action="/api/hearts" method="post">
            <Hidden fields={{ action: 'trash-empty', scope: 'all', next: here }} />
            <label className="stack">Type yes
              <input name="confirm" autoComplete="off" data-testid="trash-empty-all-confirm" />
            </label>
            <div className="actions"><button className="btn danger" type="submit">Empty all Recently removed</button></div>
          </form>
        </section>
      ) : null}
    </>
  )
}

export async function PortalTrashScreen(ctx: Ctx) {
  const { payload, portal, base } = ctx
  const items = await listTrash(payload, portal.id)
  return (
    <AdminFrame ctx={ctx} active="trash" title="Recently removed" intro="A short grace period for courses, talks, codes and packs taken off this portal." testId="admin-trash">
      <TrashBody items={items} here={`${base}/admin/trash`} portalSlug={portal.slug} timeZone={portalTimeZone(portal)} />
    </AdminFrame>
  )
}

export async function MasterTrashScreen(ctx: MasterCtx) {
  const query = ctx.query as { portal?: string }
  let portalId: number | null = null
  let portalSlug = ''
  const portals = await rows(ctx.payload, 'portals', undefined, { sort: 'name' })
  if (query.portal) {
    const found = portals.find((row) => str(row.slug) === query.portal)
    portalId = found?.id || null
    portalSlug = found ? str(found.slug) : ''
  }
  const items = await listTrash(ctx.payload, portalId)
  return (
    <MasterFrame ctx={ctx} active="trash" title="Recently removed" intro="Content taken off any portal. Restore within 30 days. People are never kept here." testId="master-trash">
      <form method="get" action="/master/trash" className="form" style={{ marginBottom: 16 }}>
        <label className="stack">Portal
          <select name="portal" defaultValue={query.portal || ''} data-testid="trash-portal">
            <option value="">All portals</option>
            {portals.map((portal) => <option key={portal.id} value={str(portal.slug)}>{str(portal.name)}</option>)}
          </select>
        </label>
        <button className="btn ghost small" type="submit">Show this portal</button>
      </form>
      <TrashBody items={items} here={query.portal ? `/master/trash?portal=${encodeURIComponent(query.portal)}` : '/master/trash'} portalSlug={portalSlug} timeZone={query.portal ? portalTimeZone(portals.find((row) => str(row.slug) === query.portal)) : DEFAULT_TIME_ZONE} master />
    </MasterFrame>
  )
}
