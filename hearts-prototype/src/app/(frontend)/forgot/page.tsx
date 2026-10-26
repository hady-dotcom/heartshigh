import Link from 'next/link'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { Flash, Hidden } from '@/components/app/shell'
import { TurnstileField } from '@/components/app/turnstile-field'
import { BrandLockup } from '@/components/brand'
import { brandForDoor, nextQuery, safeNext } from '@/lib/door-brand'

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ next?: string }> }): Promise<Metadata> {
  const query = await searchParams
  const door = await brandForDoor(safeNext(query.next), (await cookies()).get('hh_door')?.value)
  if (!door.name) return { title: 'HEARTS' }
  const hady = door.logo === '/icons/hady-home.svg'
  return {
    title: door.name,
    description: `${door.name}. Watch the films in order.`,
    applicationName: door.name,
    ...(hady ? { manifest: '/hady-home.webmanifest' } : {}),
    appleWebApp: { capable: true, title: door.name, statusBarStyle: 'black-translucent' },
    ...(door.logo ? { icons: { icon: [{ url: door.logo, ...(door.logo.endsWith('.svg') ? { type: 'image/svg+xml' } : {}) }], apple: [{ url: door.logo }] } } : {}),
  }
}

export default async function Forgot({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string; next?: string }> }) {
  const query = await searchParams
  const next = safeNext(query.next)
  const door = await brandForDoor(next, (await cookies()).get('hh_door')?.value)
  const dest = next !== '/' ? next : (door.home || '/')
  const brand = door
  const back = `/login${nextQuery(dest)}`
  return (
    <main className="door apple-door" data-testid="forgot">
      <div className="door-card">
        {brand.name ? <p className="brand-word" data-testid="portal-brand">{brand.name}</p> : <BrandLockup size={72} />}
        <h1>Reset your password</h1>
        <p className="lede">Enter the email you joined with. If we have an account for it, we send a reset link.</p>
        <Flash error={query.error} notice={query.notice} />
        <form className="door-form" action="/api/hearts" method="post">
          <Hidden fields={{ action: 'forgot-password', next: dest }} />
          <label>Email<input className="field" data-testid="forgot-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
          <TurnstileField />
          <button className="pill gold block" data-testid="forgot-submit" type="submit">Send the link</button>
        </form>
        <div className="door-links"><Link href={back}>Back to sign in</Link></div>
      </div>
    </main>
  )
}
