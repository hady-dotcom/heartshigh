import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AppFrame, Flash, TabBar } from '@/components/app/shell'
import { ComingUp, LiveNowBanner } from '@/components/app/live-banner'
import { LiveWatchClient } from '@/components/app/live-watch'
import { canGoLive, canSeeLive } from '@/lib/live'
import { idOf, portalIdOf } from '@/lib/ids'
import { homeLive, listQuestions, listSessions, publicCard, sessionById } from '@/server/live'
import { unreadCount, type Ctx } from '../common'

export async function liveHomeBits(ctx: Pick<Ctx, 'payload' | 'portal' | 'user'>) {
  return homeLive(ctx.payload, ctx.portal, ctx.user)
}

export function HomeLive({
  live,
  upcoming,
  base,
  portal,
}: {
  live: Awaited<ReturnType<typeof homeLive>>['live']
  upcoming: Awaited<ReturnType<typeof homeLive>>['upcoming']
  base: string
  portal: string
}) {
  return (
    <>
      <LiveNowBanner href={`${base}/live`} session={live} portal={portal} />
      <ComingUp cards={upcoming} portal={portal} base={base} />
      <Link className="pill outline small" href={`${base}/live`} data-testid="open-live" style={{ margin: '8px 0 14px' }}>Live</Link>
    </>
  )
}

export async function LiveIndexScreen(ctx: Ctx) {
  const { payload, user, portal, base, query } = ctx
  if (!canSeeLive(user.role, portalIdOf(user), portal.id)) notFound()
  const cards = await listSessions(payload, portal, user.id)
  const live = cards.find((card) => card.status === 'live') || null
  const upcoming = cards.filter((card) => card.status === 'scheduled')
  const ended = cards.filter((card) => card.status === 'ended').slice(0, 8)
  const unread = await unreadCount(payload, user)
  const slug = String(portal.slug)
  return (
    <AppFrame testId="live-home">
      <div className="app-scroll">
        <div className="app-head">
          <Link className="back" href={base}>Home</Link>
          <h1>Live</h1>
        </div>
        <Flash error={query.error} notice={query.notice} />
        {live ? <LiveNowBanner href={`${base}/live`} session={live} portal={slug} /> : null}
        <ComingUp
          cards={upcoming.map((card) => ({ id: card.id, title: card.title, hostFirst: card.hostFirst, when: card.when, reminded: card.reminded }))}
          portal={slug}
          base={`${base}/live`}
        />
        {ended.length ? (
          <section data-testid="live-replays">
            <p className="eyebrow">Replays</p>
            {ended.map((card) => (
              <p key={card.id}><Link href={`${base}/live/${card.id}`} data-testid="live-replay">{card.title}</Link> <span className="muted">{card.when}</span></p>
            ))}
          </section>
        ) : null}
        {!live && !upcoming.length && !ended.length ? <p data-testid="live-empty">Nothing is live, and nothing is scheduled.</p> : null}
      </div>
      <TabBar base={base} active="home" unread={unread} />
    </AppFrame>
  )
}

export async function LiveWatchScreen(ctx: Ctx, id: number) {
  const { payload, user, portal, base, query } = ctx
  if (!canSeeLive(user.role, portalIdOf(user), portal.id)) notFound()
  const row = await sessionById(payload, id)
  if (!row || idOf(row.portal) !== portal.id) notFound()
  const staff = canGoLive(user.role, portalIdOf(user), portal.id)
  const card = await publicCard(payload, portal, row!, user.id)
  const questions = await listQuestions(payload, id, user, staff)
  const unread = await unreadCount(payload, user)
  return (
    <AppFrame testId="live-screen">
      <div className="app-scroll live-shell">
        <div className="app-head">
          <Link className="back" href={`${base}/live`}>Live</Link>
          <h1>{card.status === 'live' ? 'Live' : card.status === 'ended' ? 'Replay' : 'Coming up'}</h1>
        </div>
        <Flash error={query.error} notice={query.notice} />
        {card.status === 'scheduled' ? (
          <section className="live-coming-card" data-testid="live-lobby">
            <b>{card.title}</b>
            <small>{card.hostName} · {card.when}</small>
            {card.reminded ? (
              <p data-testid="coming-up-set">We’ll remind you when it starts.</p>
            ) : (
              <form action="/api/live" method="post">
                <input type="hidden" name="action" value="remind" />
                <input type="hidden" name="id" value={card.id} />
                <input type="hidden" name="portal" value={String(portal.slug)} />
                <input type="hidden" name="next" value={`${base}/live/${card.id}`} />
                <button className="pill gold" type="submit" data-testid="ill-be-there" data-write>I’ll be there</button>
              </form>
            )}
          </section>
        ) : (
          <LiveWatchClient portal={String(portal.slug)} initial={{ session: card, questions }} staff={staff} />
        )}
      </div>
      <TabBar base={base} active="home" unread={unread} />
    </AppFrame>
  )
}
