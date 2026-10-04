import Link from 'next/link'
import { Flash, Hidden } from '@/components/app/shell'
import { TurnstileField } from '@/components/app/turnstile-field'
import { BrandLockup } from '@/components/brand'

export default async function Forgot({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const query = await searchParams
  return (
    <main className="door garden-door" data-testid="forgot">
      <div className="door-card">
        <BrandLockup size={72} />
        <h1>Reset your password</h1>
        <p className="lede">Enter the email you joined with. If we have an account for it, we send a reset link.</p>
        <Flash error={query.error} notice={query.notice} />
        <form className="door-form" action="/api/hearts" method="post">
          <Hidden fields={{ action: 'forgot-password' }} />
          <label>Email<input className="field" data-testid="forgot-email" name="email" type="email" autoComplete="email" required /></label>
          <TurnstileField />
          <button className="pill gold block" data-testid="forgot-submit" type="submit">Send the link</button>
        </form>
        <div className="door-links"><Link href="/login">Back to sign in</Link></div>
      </div>
    </main>
  )
}
