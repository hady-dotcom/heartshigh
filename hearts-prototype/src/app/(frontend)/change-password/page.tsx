import { redirect } from 'next/navigation'
import { Flash, Hidden } from '@/components/app/shell'
import { BrandLockup } from '@/components/brand'
import { requireUser } from '@/server/context'

export default async function ChangePassword({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string; next?: string }> }) {
  const session = await requireUser()
  if (!session.actor.mustChangePassword) redirect('/')
  const query = await searchParams
  const next = query.next && query.next.startsWith('/') && !query.next.startsWith('//') ? query.next : '/'
  return (
    <main className="door garden-door" data-testid="change-password">
      <div className="door-card">
        <BrandLockup size={72} />
        <h1>Choose a new password</h1>
        <p className="lede">The password you were given is only for this first sign-in. Pick your own, then you can carry on.</p>
        <Flash error={query.error} notice={query.notice} />
        <form className="door-form" action="/api/hearts" method="post">
          <Hidden fields={{ action: 'change-password', next }} />
          <label>New password<input className="field" data-testid="new-password" name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
          <label>Type it again<input className="field" data-testid="new-password-again" name="again" type="password" autoComplete="new-password" minLength={8} required /></label>
          <button className="pill gold block" data-testid="change-password-submit" type="submit">Save my password</button>
        </form>
      </div>
    </main>
  )
}
