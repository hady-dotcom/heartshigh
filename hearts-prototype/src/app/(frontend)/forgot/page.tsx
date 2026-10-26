import Link from 'next/link'
import { Flash, Hidden } from '@/components/app/shell'
import { TurnstileField } from '@/components/app/turnstile-field'
import { BrandLockup } from '@/components/brand'
import { brandForNext, nextQuery, safeNext } from '@/lib/door-brand'

export default async function Forgot({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string; next?: string }> }) {
  const query = await searchParams
  const next = safeNext(query.next)
  const brand = await brandForNext(next)
  const back = `/login${nextQuery(next)}`
  return (
    <main className="door apple-door" data-testid="forgot">
      <div className="door-card">
        {brand.name ? <p className="brand-word" data-testid="portal-brand">{brand.name}</p> : <BrandLockup size={72} />}
        <h1>Reset your password</h1>
        <p className="lede">Enter the email you joined with. If we have an account for it, we send a reset link.</p>
        <Flash error={query.error} notice={query.notice} />
        <form className="door-form" action="/api/hearts" method="post">
          <Hidden fields={{ action: 'forgot-password', next }} />
          <label>Email<input className="field" data-testid="forgot-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
          <TurnstileField />
          <button className="pill gold block" data-testid="forgot-submit" type="submit">Send the link</button>
        </form>
        <div className="door-links"><Link href={back}>Back to sign in</Link></div>
      </div>
    </main>
  )
}
