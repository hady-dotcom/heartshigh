import Link from 'next/link'
import { Flash, Hidden } from '@/components/app/shell'
import { BrandLockup } from '@/components/brand'

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const query = await searchParams
  const next = query.next && query.next.startsWith('/') && !query.next.startsWith('//') ? query.next : '/'
  return (
    <main className="door" data-testid="login">
      <div className="door-card">
        <BrandLockup size={72} />
        <h1>Welcome back</h1>
        <p className="lede">Sign in and we will take you to where you left off.</p>
        <Flash error={query.error} />
        <form className="door-form" action="/api/hearts" method="post">
          <Hidden fields={{ action: 'login', next }} />
          <label>E-mail<input className="field" data-testid="login-email" name="email" type="email" autoComplete="username" required /></label>
          <label>Password<input className="field" data-testid="login-password" name="password" type="password" autoComplete="current-password" required /></label>
          <button className="pill gold block" data-testid="login-submit" type="submit">Sign in</button>
        </form>
        <div className="door-links"><Link href="/join">I have an access code</Link><Link href="/">Back</Link></div>
      </div>
    </main>
  )
}
