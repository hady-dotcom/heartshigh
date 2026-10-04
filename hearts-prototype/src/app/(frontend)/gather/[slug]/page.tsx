import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { CopyLink } from '@/components/app/copy-link'
import { Flash, Hidden } from '@/components/app/shell'
import { Qr } from '@/components/qr'
import { KIND_LABEL } from '@/lib/gather'
import { shareOrigin } from '@/lib/site-origin'
import { getSession } from '@/server/context'
import { publicView, sharePack } from '@/server/gather'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const { payload } = await getSession()
  const view = await publicView(payload, slug)
  if (!view) return { title: 'Gather' }
  const description = [view.card.when, view.card.place, view.portalName].filter(Boolean).join(' · ')
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
  const share = sharePack(shareOrigin(headerList), view.card, query.with || '')
  const join = view.code
    ? `/join?code=${encodeURIComponent(view.code)}${query.guest ? `&gatherGuest=${encodeURIComponent(query.guest)}` : ''}${query.name ? `&name=${encodeURIComponent(query.name)}` : ''}&after=${encodeURIComponent(`/p/${view.portalSlug}/gather`)}`
    : '/join'
  return (
    <main className="public-gather invite" data-testid="public-gather">
      <div className="wrap">
        <p className="kicker">Gather · {view.portalName}</p>
        <h1>{view.card.title}</h1>
        <p className="when-line" data-testid="public-when">{view.card.when}{view.card.place ? ` · ${view.card.place}` : ''}</p>
        <Flash error={query.error} notice={query.notice} />
        <section className="gather-card rsvp-card" data-testid="public-rsvp">
          {query.rsvp === '1' ? (
            <div data-testid="guest-saved">
              <p>You’re on the list. If you’d like the talks as well, the code for {view.portalName} is already filled in.</p>
              <Link className="pill gold" href={join} data-testid="join-from-gather">Join {view.portalName}</Link>
            </div>
          ) : (
            <form action="/api/gather" method="post">
              <Hidden fields={{ action: 'guest', slug: view.card.slug, with: query.with || '', next: `/gather/${view.card.slug}${query.with ? `?with=${query.with}` : ''}` }} />
              <label>Your first name<input className="field" name="name" required data-testid="guest-name" autoComplete="given-name" /></label>
              <label>Phone or email<input className="field" name="contact" required data-testid="guest-contact" /></label>
              <label className="gold-toggle"><input type="checkbox" name="remind" /><i aria-hidden="true" /><span>Remind me the day before</span></label>
              <div className="gather-actions">
                <button className="pill gold small" name="choice" value="going" type="submit" data-testid="guest-going">I’m coming</button>
                <button className="pill outline small" name="choice" value="maybe" type="submit">Maybe</button>
                <button className="pill outline small" name="choice" value="cant" type="submit">Can’t</button>
              </div>
            </form>
          )}
        </section>
        <section className="gather-card" data-testid="public-details">
          {view.card.linkLabel ? <p>{view.card.linkLabel}</p> : null}
          <div>
            <span className="gather-chip gold">{view.card.audienceLabel}</span>
            <span className="gather-chip ivy">{KIND_LABEL[view.card.kind as keyof typeof KIND_LABEL] || 'Circle'}</span>
          </div>
          <p className="gather-meta">
            <span>Host: {view.card.hostLabel}</span>
            {view.card.bring ? <span>Bring: {view.card.bring}</span> : null}
            {view.card.note ? <span>{view.card.note}</span> : null}
            <span data-testid="public-count">{view.card.capacity > 0 ? `${view.card.going} of ${view.card.capacity} places` : `${view.card.going} coming`}</span>
          </p>
          {view.names.length ? <p data-testid="public-names">Coming: {view.names.join(', ')}{view.more ? ` and ${view.more} more` : ''}</p> : null}
          {view.card.mapUrl ? <a className="pill outline" href={view.card.mapUrl} data-testid="open-maps">Open in Maps</a> : null}
        </section>
        <div className="gather-actions">
          <a className="pill gold small" href={share.whatsApp} data-testid="public-whatsapp">WhatsApp</a>
          <CopyLink value={share.url} />
          <a className="pill outline small" href={share.icsPath} data-testid="public-ics">Calendar file</a>
          <a className="pill outline small" href={share.google}>Google Calendar</a>
        </div>
        <details className="gather-more">
          <summary>Wording for Meetup, Eventbrite or Facebook</summary>
          <textarea className="field" readOnly data-testid="public-cross-post" value={share.crossPost} />
        </details>
        <section className="gather-card" data-testid="public-invite-qr">
          <div className="door-qr"><Qr value={share.url || `/gather/${view.card.slug}`} testId="invite-qr" /></div>
          <p style={{ textAlign: 'center', margin: '8px 0 0' }}>Scan to open this invite.</p>
        </section>
      </div>
    </main>
  )
}
