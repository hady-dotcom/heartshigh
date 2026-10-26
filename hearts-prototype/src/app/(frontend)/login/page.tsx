import Link from 'next/link'
import type { Metadata } from 'next'
import { Flash, Hidden } from '@/components/app/shell'
import { PageHelp } from '@/components/app/page-help'
import { TurnstileField } from '@/components/app/turnstile-field'
import { BrandLockup } from '@/components/brand'
import { cookies } from 'next/headers'
import { isDemoStageLogin } from '@/lib/demo-stage-gate'
import { brandForDoor, nextQuery, safeNext } from '@/lib/door-brand'
import { DemoStageLogin } from '../demo-stage/entry'

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
  const brand = await brandForDoor(safeNext(query.next), (await cookies()).get('hh_door')?.value)
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
  const door = await brandForDoor(next, (await cookies()).get('hh_door')?.value)
  const dest = next !== '/' ? next : (door.home || '/')
  const brand = door
  return (
    <main className="door apple-door" data-testid="login">
      <PageHelp page="login" />
      <div className="door-card">
        {brand.name ? <p className="brand-word" data-testid="portal-brand">{brand.name}</p> : <BrandLockup size={72} />}
        <h1>Welcome back</h1>
        <p className="lede">Sign in and we will take you to where you left off.</p>
        <Flash error={query.error} notice={query.notice} />
        <form className="door-form" action="/api/hearts" method="post">
          <Hidden fields={{ action: 'login', next: dest }} />
          <label>Email<input className="field" data-testid="login-email" name="email" type="email" autoComplete="username" placeholder="you@example.com" required /></label>
          <label>Password<input className="field" data-testid="login-password" name="password" type="password" autoComplete="current-password" placeholder="Your password" required /></label>
          <TurnstileField />
          <button className="pill gold block" data-testid="login-submit" type="submit">Sign in</button>
        </form>
        <div className="door-links"><Link href={`/forgot${nextQuery(dest)}`}>Forgot password</Link><Link href={`/join${nextQuery(dest)}`}>I have an access code</Link><Link href={dest === '/' ? '/' : dest}>Back</Link></div>
      </div>
    </main>
  )
}
