import Link from 'next/link'
import { Flash, Hidden } from '@/components/app/shell'
import { BrandLockup } from '@/components/brand'

export default async function Join({ searchParams }: { searchParams: Promise<{ error?: string; code?: string; name?: string; gatherGuest?: string; after?: string }> }) {
  const query = await searchParams
  const code = query.code || ''
  return (
    <main className="door garden-door" data-testid="join">
      <div className="door-card">
        <BrandLockup size={72} />
        <h1>Come in</h1>
        <p className="lede">{code ? 'Your code’s already in. Just add your name.' : 'Type the access code you were given, then your name.'}</p>
        <Flash error={query.error} />
        <form className="door-form" action="/api/hearts" method="post">
          <Hidden fields={{ action: 'join', gatherGuest: query.gatherGuest, after: query.after }} />
          <label>Access code<input className="field" data-testid="join-code" name="code" defaultValue={code} autoCapitalize="characters" required /></label>
          <label>Your name<input className="field" data-testid="join-name" name="name" defaultValue={query.name || ''} autoComplete="name" required /></label>
          <label>E-mail<input className="field" data-testid="join-email" name="email" type="email" autoComplete="email" required /></label>
          <label>Password<input className="field" data-testid="join-password" name="password" type="password" minLength={8} autoComplete="new-password" required /></label>
          <button className="pill gold block" data-testid="join-submit" type="submit">Join</button>
        </form>
        {code ? null : <p className="door-hint">Use the code your masjid gave you.</p>}
        <div className="door-links"><Link href="/login">I already have an account</Link></div>
      </div>
    </main>
  )
}
