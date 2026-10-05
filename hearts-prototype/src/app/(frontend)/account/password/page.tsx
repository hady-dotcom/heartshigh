import { Flash, Hidden } from '@/components/app/shell'
import { BrandLockup } from '@/components/brand'
import { PageHelp } from '@/components/app/page-help'

export default async function MustChangePassword({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string; next?: string }> }) {
  const query = await searchParams
  const next = query.next && query.next.startsWith('/') && !query.next.startsWith('//') ? query.next : '/'
  return (
    <main className="door garden-door" data-testid="must-change-password">
      <div className="door-card">
        <BrandLockup size={72} />
        <h1>Choose your own password <PageHelp topic="changePassword" /></h1>
        <p className="lede">A teacher set a temporary one. Pick a password only you know, at least 8 characters.</p>
        <Flash error={query.error} notice={query.notice} />
        <form className="door-form" action="/api/hearts" method="post">
          <Hidden fields={{ action: 'change-password', next }} />
          <label>Temporary password<input className="field" data-testid="current-password" name="currentPassword" type="password" autoComplete="current-password" required /></label>
          <label>New password<input className="field" data-testid="new-password" name="password" type="password" minLength={8} autoComplete="new-password" required /></label>
          <label>New password again<input className="field" data-testid="new-password-again" name="passwordAgain" type="password" minLength={8} autoComplete="new-password" required /></label>
          <button className="pill gold block" data-testid="change-password-submit" type="submit">Save password</button>
        </form>
      </div>
    </main>
  )
}
