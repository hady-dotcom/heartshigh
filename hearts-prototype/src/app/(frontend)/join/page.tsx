import Link from 'next/link'
import type { Metadata } from 'next'
import { Flash, Hidden } from '@/components/app/shell'
import { PageHelp } from '@/components/app/page-help'
import { BrandLockup } from '@/components/brand'
import { getPayload } from 'payload'
import config from '@payload-config'
import { portalDisplayName } from '@/lib/portal-name'

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ code?: string }> }): Promise<Metadata> {
  const query = await searchParams
  const code = query.code || ''
  let invited = 'Someone in your circle'
  if (code) {
    try {
      const payload = await getPayload({ config })
      const found = await payload.find({ collection: 'access-codes', overrideAccess: true, depth: 1, limit: 1, where: { code: { equals: code } } })
      const portal = found.docs[0]?.portal as { name?: string; slug?: string } | number | null
      if (portal && typeof portal === 'object') invited = portalDisplayName(portal)
    } catch {
      // The join page still works without a lookup.
    }
  }
  return {
    title: `${invited} invited you to HEARTS`,
    description: 'Short talks from real lectures, a few minutes a day, and a circle that meets in person.',
    openGraph: {
      title: `${invited} invited you to HEARTS`,
      description: 'Short talks from real lectures, a few minutes a day, and a circle that meets in person.',
      images: [{ url: '/theme/evening-courtyard.jpg', width: 1200, height: 630, alt: 'The HEARTS garden courtyard' }],
    },
  }
}

export default async function Join({ searchParams }: { searchParams: Promise<{ error?: string; code?: string; name?: string; gatherGuest?: string; after?: string }> }) {
  const query = await searchParams
  const code = query.code || ''
  let invited = 'Someone in your circle'
  if (code) {
    try {
      const payload = await getPayload({ config })
      const found = await payload.find({ collection: 'access-codes', overrideAccess: true, depth: 1, limit: 1, where: { code: { equals: code } } })
      const portal = found.docs[0]?.portal as { name?: string; slug?: string } | number | null
      if (portal && typeof portal === 'object') invited = portalDisplayName(portal)
    } catch {
      invited = 'Someone in your circle'
    }
  }
  return (
    <main className="door garden-door" data-testid="join">
      <PageHelp page="join" />
      <div className="door-card">
        <BrandLockup size={72} />
        <h1>Come in</h1>
        <p className="lede" data-testid="join-pitch">HEARTS is short talks from real lectures, a few minutes a day. {invited} invited you.</p>
        <p className="lede">{code ? 'Your code is already filled in. Add your name, email and a password to join.' : 'Type the access code you were given, then your name, email and a password.'}</p>
        <Flash error={query.error} />
        <form className="door-form" action="/api/hearts" method="post">
          <Hidden fields={{ action: 'join', gatherGuest: query.gatherGuest, after: query.after }} />
          <label>Access code<input className="field" data-testid="join-code" name="code" defaultValue={code} autoCapitalize="characters" required /></label>
          <label>Your name<input className="field" data-testid="join-name" name="name" defaultValue={query.name || ''} autoComplete="name" required /></label>
          <label>Email<input className="field" data-testid="join-email" name="email" type="email" autoComplete="email" required /></label>
          <label>Password<input className="field" data-testid="join-password" name="password" type="password" minLength={8} autoComplete="new-password" required /></label>
          <button className="pill gold block" data-testid="join-submit" type="submit">Join</button>
        </form>
        {code ? null : <p className="door-hint">Use the code your masjid gave you.</p>}
        <div className="door-links"><Link href="/login">I already have an account</Link></div>
      </div>
    </main>
  )
}
