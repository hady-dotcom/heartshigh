import Link from 'next/link'
import type { Payload } from 'payload'
import { ExampleInUse } from '@/components/app/care'
import { Hidden } from '@/components/app/shell'
import type { SessionUser } from '@/server/context'
import type { Ctx } from '../common'
import { shellOf } from '@/lib/portal-look'
import { rows } from '../common'
import { AdminFrame } from './overview'
import { DeskFrame, masterNav } from './shell'

type BinRow = { id: number; kind?: unknown; title?: unknown; mode?: unknown; recordId?: unknown }

async function openRows(payload: Payload, portalId: number | null) {
  const where = portalId
    ? { and: [{ undone: { not_equals: true } }, { portal: { equals: portalId } }] }
    : { undone: { not_equals: true } }
  return rows(payload, 'desk-bin', where as never, { sort: '-createdAt', limit: 100 }) as Promise<BinRow[]>
}

function BinList({ items, next, libraryHref, plain = false }: { items: BinRow[]; next: string; libraryHref: string; plain?: boolean }) {
  const talks = items.filter((item) => String(item.kind || '') === 'lesson')
  return (
    <section className="panel" data-testid="bin-list">
      <header className="light"><h2>In the bin ({items.length})</h2></header>
      <div className="body" style={{ display: 'grid', gap: 12 }}>
        {talks.length ? (
          <form action="/api/hearts" method="post" data-testid="empty-bin-form">
            <Hidden fields={{ action: 'desk-empty-bin', next }} />
            <p>Empty bin removes the talks here for good. Courses and join codes stay as they are.</p>
            <label className="check">
              <input type="checkbox" name="sure" value="yes" required data-testid="empty-bin-sure" /> Yes, empty the bin
            </label>
            <button className="btn danger small" type="submit" data-testid="empty-bin">Empty bin</button>
          </form>
        ) : null}
        {items.map((item) => {
          const talkId = Number(item.recordId)
          const isTalk = String(item.kind || '') === 'lesson' && talkId > 0
          return (
            <article key={item.id} data-testid="bin-row" data-kind={String(item.kind || '')}>
              <b>{String(item.title || 'Deleted item')}</b>
              <p className="hint" style={{ margin: '4px 0' }}>{isTalk ? 'Talk · hidden from learners and courses' : `${String(item.kind || '')}${item.mode === 'gone' ? '' : ' · hidden'}`}</p>
              <div className="actions" style={{ justifyContent: 'flex-start' }}>
                {isTalk ? <Link className="btn ghost small" href={`${libraryHref}/talk/${talkId}`} data-testid="bin-open">Open</Link> : null}
                <form action="/api/hearts" method="post">
                  <Hidden fields={{ action: 'desk-undo', bin: item.id, next }} />
                  <button className="btn small" type="submit" data-testid="bin-undo">Put back</button>
                </form>
              </div>
            </article>
          )
        })}
        {!items.length ? (
          <ExampleInUse desk testId="bin-empty" title={plain ? 'A film you set aside' : 'The Names, class 20'} action={{ href: libraryHref, label: plain ? 'Open films' : 'Open the library' }}>
            <p>{plain ? 'A short film · 12 minutes' : 'Shaykh Mikaeel Smith · HJ10 · YouTube · 47 minutes'}</p>
            <p className="hint">{plain ? 'Move a film to the bin when you want it hidden. Put it back and the same film opens again.' : 'Move a talk to the bin when you want it hidden. Put it back and the same talk opens again.'}</p>
          </ExampleInUse>
        ) : null}
      </div>
    </section>
  )
}

export async function MasterBin({ payload, user, query }: { payload: Payload; user: SessionUser; query: { error?: string; notice?: string } }) {
  const items = await openRows(payload, null)
  return (
    <DeskFrame payload={payload} user={user} title="Bin" intro="Talks you moved here are hidden. Put back brings the same talk out. Empty bin removes talks for good." active="bin" nav={masterNav()} brand="HEARTS" subBrand="Master desk" brandHref="/master" query={query} testId="master-bin" showOnPhone>
      <BinList items={items} next="/master/bin" libraryHref="/master/library" />
    </DeskFrame>
  )
}

export async function PortalBin(ctx: Ctx) {
  const items = await openRows(ctx.payload, ctx.portal.id)
  return (
    <AdminFrame ctx={ctx} active="bin" title="Bin" intro="Talks you moved here are hidden. Put back brings the same talk out. Empty bin removes talks for good." testId="portal-bin" showOnPhone>
      <BinList items={items} next={`${ctx.base}/admin/bin`} libraryHref={`${ctx.base}/admin/library`} plain={shellOf(ctx.portal) === 'modern'} />
    </AdminFrame>
  )
}
