import type { Payload } from 'payload'
import { Hidden } from '@/components/app/shell'
import type { SessionUser } from '@/server/context'
import type { Ctx } from '../common'
import { rows } from '../common'
import { AdminFrame } from './overview'
import { DeskFrame, masterNav } from './shell'

type BinRow = { id: number; kind?: unknown; title?: unknown; mode?: unknown }

async function openRows(payload: Payload, portalId: number | null) {
  const where = portalId
    ? { and: [{ undone: { not_equals: true } }, { portal: { equals: portalId } }] }
    : { undone: { not_equals: true } }
  return rows(payload, 'desk-bin', where as never, { sort: '-createdAt', limit: 100 }) as Promise<BinRow[]>
}

function BinList({ items, next }: { items: BinRow[]; next: string }) {
  return (
    <section className="panel" data-testid="bin-list">
      <header className="light"><h2>Deleted ({items.length})</h2></header>
      <div className="body" style={{ display: 'grid', gap: 12 }}>
        {items.map((item) => (
          <article key={item.id} data-testid="bin-row" data-kind={String(item.kind || '')}>
            <b>{String(item.title || 'Deleted item')}</b>
            <p className="hint" style={{ margin: '4px 0' }}>{String(item.kind || '')}{item.mode === 'gone' ? '' : ' · hidden'}</p>
            <form action="/api/hearts" method="post">
              <Hidden fields={{ action: 'desk-undo', bin: item.id, next }} />
              <button className="btn small" type="submit" data-testid="bin-undo">Undo</button>
            </form>
          </article>
        ))}
        {!items.length ? <p className="empty" data-testid="bin-empty">The bin is empty.</p> : null}
      </div>
    </section>
  )
}

export async function MasterBin({ payload, user, query }: { payload: Payload; user: SessionUser; query: { error?: string; notice?: string } }) {
  const items = await openRows(payload, null)
  return (
    <DeskFrame payload={payload} user={user} title="Bin" intro="Things deleted from the master desk. Undo puts one back." active="bin" nav={masterNav()} brand="HEARTS" subBrand="Master desk" brandHref="/master" query={query} testId="master-bin">
      <BinList items={items} next="/master/bin" />
    </DeskFrame>
  )
}

export async function PortalBin(ctx: Ctx) {
  const items = await openRows(ctx.payload, ctx.portal.id)
  return (
    <AdminFrame ctx={ctx} active="bin" title="Bin" intro="Things deleted in this portal. Undo puts one back. A sheet import cannot be undone." testId="portal-bin">
      <BinList items={items} next={`${ctx.base}/admin/bin`} />
    </AdminFrame>
  )
}
