import Link from 'next/link'
import { Flash, Hidden } from '@/components/app/shell'
import { TurnstileField } from '@/components/app/turnstile-field'
import { BrandLockup } from '@/components/brand'

export default async function Reset({ searchParams }: { searchParams: Promise<{ error?: string; token?: string }> }) {
  const query = await searchParams
  const token = query.token || ''
  return (
    <main className="door garden-door" data-testid="reset">
      <div className="door-card">
        <BrandLockup size={72} />
        <h1>Choose a new password</h1>
        <p className="lede">{token ? 'Pick a new password for this account.' : 'This page needs the link from your email.'}</p>
        <Flash error={query.error} />
        {token ? (
          <form className="door-form" action="/api/hearts" method="post">
            <Hidden fields={{ action: 'reset-password', token }} />
            <label>New password<input className="field" data-testid="reset-password" name="password" type="password" minLength={8} autoComplete="new-password" required /></label>
            <TurnstileField />
            <button className="pill gold block" data-testid="reset-submit" type="submit">Save password</button>
          </form>
        ) : (
          <p className="door-hint">Open the reset link we sent, or ask for a new one.</p>
        )}
        <div className="door-links"><Link href="/forgot">Ask for a new link</Link><Link href="/login">Sign in</Link></div>
      </div>
    </main>
  )
}
