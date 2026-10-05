'use client'

import { useEffect, useState } from 'react'
import { LIVE_POLL_MS } from '@/lib/live'

export type LiveNowCard = {
  id: number
  title: string
  hostName: string
  hostFirst: string
  viewerCount?: number
}

export type ComingCard = {
  id: number
  title: string
  hostFirst: string
  when: string
  reminded: boolean
}

export function LiveNowBanner({
  href,
  session,
  portal,
}: {
  href: string
  session: LiveNowCard | null
  portal: string
}) {
  const [live, setLive] = useState<LiveNowCard | null>(session)
  useEffect(() => {
    setLive(session)
  }, [session])
  useEffect(() => {
    let on = true
    const tick = async () => {
      const res = await fetch(`/api/live?portal=${encodeURIComponent(portal)}`, { headers: { accept: 'application/json' } }).catch(() => null)
      const data = res && res.ok ? ((await res.json().catch(() => null)) as { live?: LiveNowCard | null } | null) : null
      if (on) setLive(data?.live || null)
    }
    const id = window.setInterval(tick, LIVE_POLL_MS)
    return () => {
      on = false
      window.clearInterval(id)
    }
  }, [portal])
  if (!live) return null
  return (
    <a className="live-now" href={`${href}/${live.id}`} data-testid="live-now">
      <span className="live-dot" aria-hidden />
      <span className="live-now-copy">
        <strong>Live now</strong>
        <span>{live.hostFirst} · {live.title}</span>
      </span>
    </a>
  )
}

export function ComingUp({
  cards,
  portal,
  base,
}: {
  cards: ComingCard[]
  portal: string
  base: string
}) {
  const [rows, setRows] = useState(cards)
  useEffect(() => {
    setRows(cards)
  }, [cards])
  useEffect(() => {
    let on = true
    const tick = async () => {
      const res = await fetch(`/api/live?portal=${encodeURIComponent(portal)}`, { headers: { accept: 'application/json' } }).catch(() => null)
      const data = res && res.ok ? ((await res.json().catch(() => null)) as { upcoming?: ComingCard[] } | null) : null
      if (on && data?.upcoming) setRows(data.upcoming)
    }
    const id = window.setInterval(tick, LIVE_POLL_MS)
    return () => {
      on = false
      window.clearInterval(id)
    }
  }, [portal])
  if (!rows.length) return null
  return (
    <section className="live-coming" data-testid="coming-up">
      <p className="eyebrow">Coming up</p>
      {rows.map((card) => (
        <article key={card.id} className="live-coming-card" data-testid="coming-up-row">
          <div>
            <b>{card.title}</b>
            <small>{card.hostFirst} · {card.when}</small>
          </div>
          {card.reminded ? (
            <span className="pill ghost" data-testid="coming-up-set">We’ll remind you</span>
          ) : (
            <form action="/api/live" method="post">
              <input type="hidden" name="action" value="remind" />
              <input type="hidden" name="id" value={card.id} />
              <input type="hidden" name="portal" value={portal} />
              <input type="hidden" name="next" value={base} />
              <button className="pill gold" type="submit" data-testid="ill-be-there" data-write>I’ll be there</button>
            </form>
          )}
        </article>
      ))}
    </section>
  )
}

export function FeedLiveBanner({ portal, base, session }: { portal: string; base: string; session: LiveNowCard | null }) {
  return (
    <div className="feed-live">
      <LiveNowBanner href={`${base}/live`} session={session} portal={portal} />
    </div>
  )
}
