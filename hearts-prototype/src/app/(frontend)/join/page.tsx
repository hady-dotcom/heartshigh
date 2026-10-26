import Link from 'next/link'
import type { Metadata } from 'next'
import { Flash, Hidden } from '@/components/app/shell'
import { PageHelp } from '@/components/app/page-help'
import { TurnstileField } from '@/components/app/turnstile-field'
import { BrandLockup } from '@/components/brand'
import { getPayload } from 'payload'
import config from '@payload-config'
import { portalLogo } from '@/lib/learner-brand'
import { portalDisplayName } from '@/lib/portal-name'
import { firstNameOf, inviteLine } from '@/lib/invite'

async function inviteFor(code: string) {
  let portal = 'Someone in your circle'
  let person = ''
  let brand = ''
  let logo = ''
  if (!code) return { line: inviteLine(portal), brand, logo }
  try {
    const payload = await getPayload({ config })
    const found = await payload.find({ collection: 'access-codes', overrideAccess: true, depth: 1, limit: 1, where: { code: { equals: code } } })
    const row = found.docs[0]
    const host = row?.portal as { name?: string; slug?: string; brandName?: string | null; logoUrl?: string | null } | number | null
    if (host && typeof host === 'object') {
      portal = portalDisplayName(host)
      brand = String(host.brandName || '').trim()
      logo = portalLogo(host.logoUrl)
    }
    const linked = row?.linkedTeacherCode
    const teacherCodeId = typeof linked === 'object' && linked ? linked.id : linked
    if (teacherCodeId) {
      const teachers = await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 1, where: { accessCode: { equals: teacherCodeId } } })
      person = firstNameOf(teachers.docs[0]?.name)
    }
  } catch {
    // The join page still works without a lookup.
  }
  return { line: inviteLine(portal, person), brand, logo }
}

function brandIcons(name: string, logo: string): Metadata {
  const hady = logo === '/icons/hady-home.svg'
  return {
    title: name,
    description: `${name}. Watch the films in order.`,
    applicationName: name,
    ...(hady ? { manifest: '/hady-home.webmanifest' } : {}),
    appleWebApp: { capable: true, title: name, statusBarStyle: 'black-translucent' },
    ...(logo
      ? { icons: { icon: [{ url: logo, ...(logo.endsWith('.svg') ? { type: 'image/svg+xml' } : {}) }], apple: [{ url: logo }] } }
      : {}),
  }
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ code?: string; from?: string; invitedBy?: string }> }): Promise<Metadata> {
  const query = await searchParams
  const invite = await inviteFor(query.code || '')
  if (invite.brand) return brandIcons(invite.brand, invite.logo)
  return {
    title: `${invite.line} to HEARTS`,
    description: 'Short talks from real lectures, a few minutes a day, and a circle that meets in person.',
    openGraph: {
      title: `${invite.line} to HEARTS`,
      description: 'Short talks from real lectures, a few minutes a day, and a circle that meets in person.',
      images: [{ url: '/theme/evening-courtyard.jpg', width: 1200, height: 630, alt: 'The HEARTS garden courtyard' }],
    },
  }
}

export default async function Join({ searchParams }: { searchParams: Promise<{ error?: string; code?: string; name?: string; from?: string; invitedBy?: string; gatherGuest?: string; after?: string }> }) {
  const query = await searchParams
  const code = query.code || ''
  const invite = await inviteFor(code)
  const invited = invite.line
  return (
    <main className="door apple-door" data-testid="join">
      <PageHelp page="join" />
      <div className="door-card">
        {invite.brand ? <p className="brand-word" data-testid="portal-brand">{invite.brand}</p> : <BrandLockup size={72} />}
        <h1>Come in</h1>
        <p className="lede" data-testid="join-pitch">{invited}.</p>
        <p className="lede">{code ? 'Your code is already filled in. Add your name, email and a password to join.' : 'Type the access code you were given, then your name, email and a password.'}</p>
        <Flash error={query.error} />
        <form className="door-form" action="/api/hearts" method="post">
          <Hidden fields={{ action: 'join', gatherGuest: query.gatherGuest, after: query.after }} />
          <label>Access code<input className="field" data-testid="join-code" name="code" defaultValue={code} autoCapitalize="characters" placeholder="The code you were given" required /></label>
          <label>Your name<input className="field" data-testid="join-name" name="name" defaultValue={query.name || ''} autoComplete="name" placeholder="Your name" required /></label>
          <label>Email<input className="field" data-testid="join-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
          <label>Password<input className="field" data-testid="join-password" name="password" type="password" minLength={8} autoComplete="new-password" placeholder="At least 8 characters" required /></label>
          <TurnstileField />
          <button className="pill gold block" data-testid="join-submit" type="submit">Join</button>
        </form>
        {code ? null : <p className="door-hint">Use the code your masjid gave you.</p>}
        <div className="door-links"><Link href="/login">I already have an account</Link></div>
      </div>
    </main>
  )
}
