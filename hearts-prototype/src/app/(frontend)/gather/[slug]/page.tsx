import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { CopyLink } from '@/components/app/copy-link'
import { Qr } from '@/components/qr'
import { Flash, Hidden } from '@/components/app/shell'
import { KIND_LABEL } from '@/lib/gather'
import { getSession } from '@/server/context'
import { publicView, sharePack } from '@/server/gather'

export const dynamic = 'force-dynamic'

function originOf(reqHeaders: Headers) {
  const host = reqHeaders.get('x-forwarded-host') || reqHeaders.get('host') || 'localhost:3000'
  const proto = reqHeaders.get('x-forwarded-proto') || (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https')
  return `${proto}://${host}`
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const { payload } = await getSession()
  const view = await publicView(payload, slug)
  if (!view) return { title: 'Gather' }
  const description = [view.card.linkLabel, view.card.when, view.card.place, view.portalName].filter(Boolean).join(' · ')
  return {
    title: `${view.card.title} · Gather`,
    description,
    openGraph: { title: view.card.title, description, type: 'website' },
  }
}

export default async function PublicGather({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { slug } = await params
  const query = await searchParams
  const headerList = await headers()
  const { payload } = await getSession()
  const view = await publicView(payload, slug)
  if (!view) notFound()
  const origin = originOf(headerList)
  const share = sharePack(origin, view.card, query.with || '')
  const join = view.code
    ? `/join?code=${encodeURIComponent(view.code)}${query.guest ? `&gatherGuest=${encodeURIComponent(query.guest)}` : ''}${query.name ? `&name=${encodeURIComponent(query.name)}` : ''}&after=${encodeURIComponent(`/p/${view.portalSlug}/gather`)}`
    : '/join'
  return (
    <main className="public-gather" data-testid="public-gather">
      <div className="wrap">
        <p className="kicker">Gather · {view.portalName}</p>
        <h1>{view.card.title}</h1>
        {view.card.linkLabel ? <p>{view.card.linkLabel}</p> : null}
        <p className="kicker" style={{ marginTop: 18 }}>How this looks in WhatsApp</p>
        <a className="wa-preview" href={share.whatsApp} data-testid="whatsapp-preview">
          <img src={`/gather/${view.card.slug}/card.png`} alt="" />
          <div>
            <small>HEARTS</small>
            <strong>{view.card.title}</strong>
            <span>{share.description}</span>
          </div>
        </a>
        <Flash error={query.error} notice={query.notice} />
        <section className="gather-card">
          <div>
            <span className="gather-chip gold">{view.card.audienceLabel}</span>
            <span className="gather-chip ivy">{KIND_LABEL[view.card.kind as keyof typeof KIND_LABEL] || 'Circle'}</span>
          </div>
          <p className="gather-meta">
            <span data-testid="public-when">{view.card.when}</span>
            <span>{view.card.place}</span>
            {view.card.mapUrl ? <a href={view.card.mapUrl}>Map</a> : null}
            <span>Host: {view.card.hostLabel}</span>
            {view.card.bring ? <span>Bring: {view.card.bring}</span> : null}
            {view.card.note ? <span>{view.card.note}</span> : null}
            <span data-testid="public-count">{view.card.capacity > 0 ? `${view.card.going} of ${view.card.capacity} places` : `${view.card.going} coming`}</span>
          </p>
          {view.names.length ? <p data-testid="public-names">Coming: {view.names.join(', ')}{view.more ? ` and ${view.more} more` : ''}</p> : null}
        </section>
        <section className="gather-card" data-testid="public-rsvp">
          <h2 style={{ marginTop: 0, color: '#0f3b3a', fontFamily: 'var(--serif)' }}>Say you’re coming</h2>
          <p>No account needed. A first name and a phone or email is enough.</p>
          {query.rsvp === '1' ? (
            <div data-testid="guest-saved">
              <p>You’re on the list. If you’d like the talks as well, the door code for {view.portalName} is already filled in.</p>
              <Link className="pill gold" href={join} data-testid="join-from-gather">Join {view.portalName}</Link>
            </div>
          ) : (
            <form action="/api/gather" method="post">
              <Hidden fields={{ action: 'guest', slug: view.card.slug, with: query.with || '', next: `/gather/${view.card.slug}${query.with ? `?with=${query.with}` : ''}` }} />
              <label>Your first name<input className="field" name="name" required data-testid="guest-name" autoComplete="given-name" /></label>
              <label>Phone or email<input className="field" name="contact" required data-testid="guest-contact" /></label>
              <label className="gather-meta" style={{ margin: '10px 0' }}><input type="checkbox" name="remind" /> Remind me the day before</label>
              <div className="gather-actions">
                <button className="pill gold small" name="choice" value="going" type="submit" data-testid="guest-going">I’m coming</button>
                <button className="pill outline small" name="choice" value="maybe" type="submit">Maybe</button>
                <button className="pill outline small" name="choice" value="cant" type="submit">Can’t</button>
              </div>
            </form>
          )}
        </section>
        <div className="gather-actions">
          <a className="pill gold small" href={share.whatsApp} data-testid="public-whatsapp">WhatsApp</a>
          <CopyLink value={share.url} />
          <a className="pill outline small" href={share.icsPath} data-testid="public-ics">Calendar file</a>
          <a className="pill outline small" href={share.google}>Google Calendar</a>
        </div>
        <section className="door-qr" data-testid="invite-qr" style={{ maxWidth: 240 }}>
          <Qr value={share.url} testId="invite-qr-code" />
          <p style={{ margin: '8px 0 0', color: '#0f3b3a', textAlign: 'center' }}>Show this to someone nearby</p>
        </section>
        <form className="share-box" style={{ marginTop: 16 }}>
          <label style={{ color: '#f7eedb' }}>Copy for Meetup, Eventbrite or Facebook
            <textarea className="field" readOnly data-testid="public-cross-post" value={share.crossPost} />
          </label>
        </form>
      </div>
    </main>
  )
}
