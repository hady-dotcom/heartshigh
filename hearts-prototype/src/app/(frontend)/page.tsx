import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Flash } from '@/components/app/shell'
import { PageHelp } from '@/components/app/page-help'
import { BrandLockup } from '@/components/brand'
import { portalIdOf } from '@/lib/ids'
import { portalHomePath } from '@/lib/landing'
import { getSession } from '@/server/context'

export default async function Door({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const query = await searchParams
  const { payload, user } = await getSession()
  let home = '/login'
  if (user?.role === 'master') home = '/master'
  else if (user) {
    const portalId = portalIdOf(user)
    const portal = portalId ? await payload.findByID({ collection: 'portals', id: portalId, overrideAccess: true, depth: 0 }).catch(() => null) : null
    const slug = (portal as { slug?: string } | null)?.slug
    if (slug) home = portalHomePath(slug, user.role)
  }
  // A signed-in visit to the door goes home. An error or notice stays here so the flash can be read.
  if (user && home !== '/login' && !query.error && !query.notice) redirect(home)
  return (
    <main className="door garden-door" data-testid="door">
      <PageHelp page="door" />
      <div className="door-card">
        <BrandLockup size={88} />
        <h1>Someone wanted good for you</h1>
        <p className="lede">Short films from real lectures, a few questions to sit with, and a circle of people to meet in person.</p>
        <p className="lede" data-testid="powered-by-donations">This has been powered by donations.</p>
        <Flash error={query.error} notice={query.notice} />
        <div style={{ display: 'grid', gap: 10 }}>
          <Link className="pill gold block" href={user ? home : '/join'} data-testid="door-primary">{user ? 'Continue' : 'I have an access code'}</Link>
          {user ? null : <Link className="pill outline block" href="/login" data-testid="door-login">Sign in</Link>}
        </div>
        {user ? null : <p className="door-hint">Teachers and portal admins sign in here too.</p>}
      </div>
    </main>
  )
}
