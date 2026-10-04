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
  if (!row || String(row.checkinToken || '') !== (query.k || '')) notFound()
  const view = await publicView(payload, slug)
  if (!view) notFound()
  const next = `/gather/${slug}/in?k=${encodeURIComponent(query.k || '')}`
  const reflect = `/p/${view.portalSlug}/gather/${view.card.id}/reflect`
  return (
    <main className="public-gather" data-testid="checkin-page">
      <div className="wrap">
        <p className="kicker">At the door</p>
        <h1>{view.card.title}</h1>
        <Flash error={query.error} notice={query.notice} />
        <section className="gather-card">
          <p>{view.card.when}</p>
          <p>{view.card.place}</p>
          {user ? (
            <form action="/api/gather" method="post">
              <Hidden fields={{ action: 'checkin', method: 'qr', id: view.card.id, token: query.k || '', next: reflect }} />
              <button className="pill gold block" type="submit" data-testid="qr-checkin">I’m here</button>
            </form>
          ) : (
            <div>
              <p>Sign in, then this page will check you in.</p>
              <Link className="pill gold" href={`/login?next=${encodeURIComponent(next)}`} data-testid="checkin-login">Sign in</Link>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
