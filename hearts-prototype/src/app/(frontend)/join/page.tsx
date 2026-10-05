import Link from 'next/link'
import type { Metadata } from 'next'
import { Flash, Hidden } from '@/components/app/shell'
import { PageHelp } from '@/components/app/page-help'
import { TurnstileField } from '@/components/app/turnstile-field'
import { BrandLockup } from '@/components/brand'
import { getPayload } from 'payload'
import config from '@payload-config'
import { portalDisplayName } from '@/lib/portal-name'
import { firstNameOf, inviteLine } from '@/lib/invite'

async function inviteFor(code: string) {
  let portal = 'Someone in your circle'
  let person = ''
  if (!code) return inviteLine(portal)
  try {
    const payload = await getPayload({ config })
    const found = await payload.find({ collection: 'access-codes', overrideAccess: true, depth: 1, limit: 1, where: { code: { equals: code } } })
    const row = found.docs[0]
    const host = row?.portal as { name?: string; slug?: string } | number | null
    if (host && typeof host === 'object') portal = portalDisplayName(host)
    const linked = row?.linkedTeacherCode
    const teacherCodeId = typeof linked === 'object' && linked ? linked.id : linked
    if (teacherCodeId) {
      const teachers = await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 1, where: { accessCode: { equals: teacherCodeId } } })
      person = firstNameOf(teachers.docs[0]?.name)
    }
  } catch {
    // The join page still works without a lookup.
  }
  return inviteLine(portal, person)
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ code?: string; from?: string; invitedBy?: string }> }): Promise<Metadata> {
  const query = await searchParams
  const line = await inviteFor(query.code || '')
  return {
    title: `${line} to Hady Core`,
    description: 'Short talks from real lectures, a few minutes a day, and a circle that meets in person.',
    openGraph: {
      title: `${line} to Hady Core`,
      description: 'Short talks from real lectures, a few minutes a day, and a circle that meets in person.',
      images: [{ url: '/theme/evening-courtyard.jpg', width: 1200, height: 630, alt: 'The Hady Core garden courtyard' }],
    },
  }
}

export default async function Join({ searchParams }: { searchParams: Promise<{ error?: string; code?: string; name?: string; from?: string; invitedBy?: string; gatherGuest?: string; after?: string }> }) {
  const query = await searchParams
  const code = query.code || ''
  const invited = await inviteFor(code)
  return (
    <main className="door garden-door" data-testid="join">
      <PageHelp page="join" />
      <div className="door-card">
        <BrandLockup size={72} />
        <h1>Come in</h1>
        <p className="lede" data-testid="join-pitch">{invited}.</p>
        <p className="lede">{code ? 'Your code is already filled in. Add your name, email and a password to join.' : 'Type the access code you were given, then your name, email and a password.'}</p>
        <Flash error={query.error} />
        <form className="door-form" action="/api/hearts" method="post">
          <Hidden fields={{ action: 'join', gatherGuest: query.gatherGuest, after: query.after }} />
          <label>Access code<input className="field" data-testid="join-code" name="code" defaultValue={code} autoCapitalize="characters" required /></label>
          <label>Your name<input className="field" data-testid="join-name" name="name" defaultValue={query.name || ''} autoComplete="name" required /></label>
          <label>Email<input className="field" data-testid="join-email" name="email" type="email" autoComplete="email" required /></label>
          <label>Password<input className="field" data-testid="join-password" name="password" type="password" minLength={8} autoComplete="new-password" required /></label>
          <TurnstileField />
          <button className="pill gold block" data-testid="join-submit" type="submit">Join</button>
        </form>
        {code ? null : <p className="door-hint">Use the code your masjid gave you.</p>}
        <div className="door-links"><Link href="/login">I already have an account</Link></div>
      </div>
    </main>
  )
}
