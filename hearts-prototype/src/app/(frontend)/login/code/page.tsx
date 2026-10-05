import { Flash, Hidden } from '@/components/app/shell'
import { BrandLockup } from '@/components/brand'
import { PageHelp } from '@/components/app/page-help'

export default async function LoginCode({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string; next?: string }> }) {
  const query = await searchParams
  const next = query.next && query.next.startsWith('/') && !query.next.startsWith('//') ? query.next : '/'
  return (
    <main className="door garden-door" data-testid="login-code">
      <div className="door-card">
        <BrandLockup size={72} />
        <h1>Enter your code <PageHelp topic="loginCode" /></h1>
        <p className="lede">Open the authenticator app on your phone, or use a backup code.</p>
        <Flash error={query.error} notice={query.notice} />
        <form className="door-form" action="/api/hearts" method="post">
          <Hidden fields={{ action: 'verify-totp', next }} />
          <label>Code<input className="field" data-testid="totp-code" name="code" inputMode="numeric" autoComplete="one-time-code" required /></label>
          <button className="pill gold block" data-testid="totp-submit" type="submit">Continue</button>
        </form>
      </div>
    </main>
  )
}
