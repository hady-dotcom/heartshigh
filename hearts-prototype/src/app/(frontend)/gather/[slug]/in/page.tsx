import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Flash, Hidden } from '@/components/app/shell'
import { getSession } from '@/server/context'
import { gatheringBySlug, publicView } from '@/server/gather'

export const dynamic = 'force-dynamic'

export default async function CheckInPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ k?: string; error?: string; notice?: string }> }) {
  const { slug } = await params
  const query = await searchParams
  const { payload, user } = await getSession()
  const row = await gatheringBySlug(payload, slug)
  if (!row || String(row.status || '') !== 'published') notFound()
  const view = await publicView(payload, slug)
  if (!view) notFound()
  const tokenOk = Boolean(query.k) && String(row.checkinToken || '') === query.k
  const next = `/gather/${slug}/in${query.k ? `?k=${encodeURIComponent(query.k)}` : ''}`
  const reflect = `/p/${view.portalSlug}/gather/${view.card.id}/reflect`
  const welcomed = query.notice === 'You’re in. Welcome.'
  return (
    <main className="public-gather" data-testid="checkin-page">
      <div className="wrap">
        <p className="kicker">At the door</p>
        <h1>{view.card.title}</h1>
        <p className="when-line">{view.card.when}{view.card.place ? ` · ${view.card.place}` : ''}</p>
        <Flash error={query.error} notice={query.notice} />
        {welcomed ? (
          <section className="gather-card welcome-card" data-testid="welcome-in">
            <h2>You’re in. Welcome.</h2>
            <Link className="pill gold" href={reflect}>One thing you’ll carry</Link>
          </section>
        ) : (
          <section className="gather-card door-checkin" data-testid="door-checkin">
            <h2>Scan the QR on the poster, or type the 4-character door code.</h2>
            {user ? (
              <>
                {tokenOk ? (
                  <form action="/api/gather" method="post">
                    <Hidden fields={{ action: 'checkin', method: 'qr', id: view.card.id, token: query.k || '', next: reflect }} />
                    <button className="pill gold block" type="submit" data-testid="qr-checkin">I’m here</button>
                  </form>
                ) : (
                  <p>The poster by the door has a QR. Scanning it checks you in.</p>
                )}
                <form action="/api/gather" method="post">
                  <Hidden fields={{ action: 'checkin', method: 'code', id: view.card.id, next: reflect }} />
                  <label>Door code
                    <input className="field entry-code" name="code" inputMode="text" autoCapitalize="characters" autoComplete="off" maxLength={4} required data-testid="entry-code" />
                  </label>
                  <button className="pill gold block" type="submit" data-testid="code-checkin">I’m here</button>
                </form>
              </>
            ) : (
              <div>
                <p>Sign in, then scan the poster or type the door code.</p>
                <Link className="pill gold" href={`/login?next=${encodeURIComponent(next)}`} data-testid="checkin-login">Sign in</Link>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
