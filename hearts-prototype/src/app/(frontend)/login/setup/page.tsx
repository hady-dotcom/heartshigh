import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Flash, Hidden } from '@/components/app/shell'
import { BrandLockup } from '@/components/brand'
import { PageHelp } from '@/components/app/page-help'
import { CopyLink } from '@/components/app/copy-link'
import { Qr } from '@/components/qr'
import { readHalfSession } from '@/lib/account-crypto'
import { groupSecret, newTotpSecret, sealTotpSecret } from '@/lib/totp'
import { getPayloadClient, getSession } from '@/server/context'
import { setupTotpState } from '@/server/account-actions'

export default async function LoginSetup({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string; next?: string; backup?: string }> }) {
  const query = await searchParams
  const next = query.next && query.next.startsWith('/') && !query.next.startsWith('//') ? query.next : '/'
  const backups = (query.backup || '').split(',').filter(Boolean)
  const half = readHalfSession((await cookies()).get('hearts_half')?.value)
  const session = backups.length ? await getSession() : null
  if (!half && !session?.user) redirect('/login')
  const payload = session?.payload || (await getPayloadClient())
  const userId = half?.userId || session?.user?.id
  if (!userId) redirect('/login')
  const user = (await payload.findByID({ collection: 'users', id: userId, overrideAccess: true, depth: 0 })) as { email?: string; totpPendingSecret?: string | null; name?: string }
  let setup: { secret: string; uri: string } | null = null
  if (!backups.length) {
    let pending = user.totpPendingSecret
    if (!pending) {
      pending = sealTotpSecret(newTotpSecret())
      await payload.update({ collection: 'users', id: userId, overrideAccess: true, data: { totpPendingSecret: pending } as never })
    }
    setup = setupTotpState(user.email || 'you', pending)
  }
  return (
    <main className="door garden-door" data-testid="login-setup">
      <div className="door-card">
        <BrandLockup size={72} />
        <h1><span style={{ whiteSpace: 'nowrap' }}>Set up two-step sign&#8209;in</span> <PageHelp topic="loginSetup" /></h1>
        <p className="lede">A code from an app on your phone, as well as your password.</p>
        <Flash error={query.error} notice={query.notice} />
        {backups.length ? (
          <section data-testid="backup-codes">
            <p>Keep these backup codes somewhere safe. Each one works once.</p>
            <ul>{backups.map((code) => <li key={code}><code>{code}</code></li>)}</ul>
            <a className="pill gold block" href={next}>Continue</a>
          </section>
        ) : (
          <>
            {setup ? <div style={{ display: 'grid', placeItems: 'center', margin: '12px 0' }}><Qr value={setup.uri} testId="totp-qr" /></div> : null}
            {setup ? (
              <div className="door-hint" data-testid="totp-secret">
                <p style={{ margin: '0 0 8px' }}>Or type this key:</p>
                <code style={{ display: 'block', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', letterSpacing: '0.06em', fontSize: 15 }}>{groupSecret(setup.secret)}</code>
                <div style={{ marginTop: 8 }}><CopyLink value={setup.secret} testId="totp-secret-copy" label="Copy key" className="pill outline small" /></div>
              </div>
            ) : null}
            <form className="door-form" action="/api/hearts" method="post">
              <Hidden fields={{ action: 'confirm-totp', next }} />
              <label>Code from the app<input className="field" data-testid="totp-setup-code" name="code" inputMode="numeric" autoComplete="one-time-code" required /></label>
              <button className="pill gold block" data-testid="totp-setup-submit" type="submit">Turn it on</button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
