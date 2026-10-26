import Link from 'next/link'
import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { Flash, Hidden } from '@/components/app/shell'
import { PageHelp } from '@/components/app/page-help'
import { TurnstileField } from '@/components/app/turnstile-field'
import { BrandLockup } from '@/components/brand'
import { portalLogo } from '@/lib/learner-brand'
import { isDemoStageLogin } from '@/lib/demo-stage-gate'
import { DemoStageLogin } from '../demo-stage/entry'

function safeNext(value: string | undefined) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

async function brandForNext(next: string) {
  const slug = next.match(/^\/p\/([^/?#]+)/)?.[1]
  if (!slug) return { name: '', logo: '' }
  try {
    const payload = await getPayload({ config })
    const found = await payload.find({ collection: 'portals', overrideAccess: true, depth: 0, limit: 1, where: { slug: { equals: slug } } })
    const portal = found.docs[0] as { brandName?: string | null; logoUrl?: string | null } | undefined
    const name = String(portal?.brandName || '').trim()
    if (name) return { name, logo: portalLogo(portal?.logoUrl) }
  } catch {
    // Sign-in still works when the portal lookup misses.
  }
  return { name: '', logo: '' }
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

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ next?: string; demo?: string }> }): Promise<Metadata> {
  const query = await searchParams
  if (isDemoStageLogin(query.next, query.demo)) {
    return {
      title: 'Demo stage sign-in',
      description: 'Master login for the demo. It returns you to the Demo stage.',
    }
  }
  const brand = await brandForNext(safeNext(query.next))
  if (brand.name) return brandIcons(brand.name, brand.logo)
  return {
    title: 'HEARTS',
    description: 'Short clips from real talks, full courses, and a circle that meets in person.',
  }
}

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string; next?: string; demo?: string }> }) {
  const query = await searchParams
  if (isDemoStageLogin(query.next, query.demo)) return <DemoStageLogin error={query.error} notice={query.notice} />
  const next = safeNext(query.next)
  const brand = await brandForNext(next)
  return (
    <main className="door apple-door" data-testid="login">
      <PageHelp page="login" />
      <div className="door-card">
        {brand.name ? <p className="brand-word" data-testid="portal-brand">{brand.name}</p> : <BrandLockup size={72} />}
        <h1>Welcome back</h1>
        <p className="lede">Sign in and we will take you to where you left off.</p>
        <Flash error={query.error} notice={query.notice} />
        <form className="door-form" action="/api/hearts" method="post">
          <Hidden fields={{ action: 'login', next }} />
          <label>Email<input className="field" data-testid="login-email" name="email" type="email" autoComplete="username" placeholder="you@example.com" required /></label>
          <label>Password<input className="field" data-testid="login-password" name="password" type="password" autoComplete="current-password" placeholder="Your password" required /></label>
          <TurnstileField />
          <button className="pill gold block" data-testid="login-submit" type="submit">Sign in</button>
        </form>
        <div className="door-links"><Link href="/forgot">Forgot password</Link><Link href="/join">I have an access code</Link><Link href="/">Back</Link></div>
      </div>
    </main>
  )
}
