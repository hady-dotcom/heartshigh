import Link from 'next/link'
import type { Metadata } from 'next'
import { Flash, Hidden } from '@/components/app/shell'
import { PageHelp } from '@/components/app/page-help'
import { TurnstileField } from '@/components/app/turnstile-field'
import { BrandLockup } from '@/components/brand'
import { isDemoStageLogin } from '@/lib/demo-stage-gate'
import { DemoStageLogin } from '../demo-stage/entry'

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ next?: string; demo?: string }> }): Promise<Metadata> {
  const query = await searchParams
  if (!isDemoStageLogin(query.next, query.demo)) {
    return {
      title: 'HEARTS',
      description: 'Short clips from real talks, full courses, and a circle that meets in person.',
    }
  }
  return {
    title: 'Demo stage sign-in',
    description: 'Master login for the demo. It returns you to the Demo stage.',
  }
}

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string; next?: string; demo?: string }> }) {
  const query = await searchParams
  if (isDemoStageLogin(query.next, query.demo)) return <DemoStageLogin error={query.error} notice={query.notice} />
  const next = query.next && query.next.startsWith('/') && !query.next.startsWith('//') ? query.next : '/'
  return (
    <main className="door garden-door" data-testid="login">
      <PageHelp page="login" />
      <div className="door-card">
        <BrandLockup size={72} />
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
