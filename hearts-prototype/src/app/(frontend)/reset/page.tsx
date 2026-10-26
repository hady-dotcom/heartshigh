import Link from 'next/link'
import { ExampleInUse } from '@/components/app/care'
import { Flash, Hidden } from '@/components/app/shell'
import { TurnstileField } from '@/components/app/turnstile-field'
import { BrandLockup } from '@/components/brand'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { brandForDoor, nextQuery, safeNext } from '@/lib/door-brand'

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ next?: string }> }): Promise<Metadata> {
  const query = await searchParams
  const door = await brandForDoor(safeNext(query.next), (await cookies()).get('hh_door')?.value)
  if (!door.name) return { title: 'HEARTS' }
  return { title: door.name, description: `${door.name}. Watch the films in order.`, applicationName: door.name }
}

export default async function Reset({ searchParams }: { searchParams: Promise<{ error?: string; token?: string; next?: string }> }) {
  const query = await searchParams
  const token = query.token || ''
  const next = safeNext(query.next)
  const door = await brandForDoor(next, (await cookies()).get('hh_door')?.value)
  const dest = next !== '/' ? next : (door.home || '/')
  const brand = door
  const signIn = `/login${nextQuery(dest)}`
  return (
    <main className="door apple-door" data-testid="reset">
      <div className="door-card">
        {brand.name ? <p className="brand-word" data-testid="portal-brand">{brand.name}</p> : <BrandLockup size={72} />}
        <h1>Choose a new password</h1>
        <p className="lede">{token ? 'Pick a new password for this account.' : 'This page needs the link from your email.'}</p>
        <Flash error={query.error} />
        {token ? (
          <form className="door-form" action="/api/hearts" method="post">
            <Hidden fields={{ action: 'reset-password', token }} />
            <label>New password<input className="field" data-testid="reset-password" name="password" type="password" minLength={8} autoComplete="new-password" placeholder="At least 8 characters" required /></label>
            <TurnstileField />
            <button className="pill gold block" data-testid="reset-submit" type="submit">Save password</button>
          </form>
        ) : (
          <ExampleInUse title="A reset link" action={{ href: `/forgot${nextQuery(dest)}`, label: 'Ask for a new link' }}>
            <p>Open the email we sent, then choose a new password on this page.</p>
          </ExampleInUse>
        )}
        <div className="door-links"><Link href={`/forgot${nextQuery(dest)}`}>Ask for a new link</Link><Link href={signIn}>Sign in</Link></div>
      </div>
    </main>
  )
}
