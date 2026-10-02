import Link from 'next/link'
import { Banner, Phone, Principle } from '@/components/chrome'
import { getSession, loadPortal } from '@/server/context'
import { portalIdOf } from '@/lib/ids'

export default async function Door({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const query = await searchParams
  const { payload, user } = await getSession()
  let home = '/login'
  if (user?.role === 'master') home = '/master'
  else if (user) {
    const portalId = portalIdOf(user)
    if (portalId) {
      const portal = await payload.findByID({ collection: 'portals', id: portalId, overrideAccess: true, depth: 0 })
      const slug = (portal as { slug?: string }).slug
      if (slug) home = user.role === 'learner' ? (user.onboarded ? `/p/${slug}/feed` : `/p/${slug}/about`) : `/p/${slug}/admin`
    }
  }
  void loadPortal
  return (
    <Phone>
      <Banner error={query.error} notice={query.notice} />
      <div className="welcome-hearts" aria-hidden>♥ ♥ ♥</div>
      <h1>Someone wanted good for you.</h1>
      <Principle
        label="Door"
        text="This is a gift, not a course catalogue."
        why="The first moment should feel like being met, not examined."
      />
      <p className="lede">Short films from real lectures. A path that does not call itself a school. A room you can actually walk into.</p>
      <div className="row">
        <Link className="button" href={user ? home : '/join'}>{user ? 'Continue' : 'I have an access code'}</Link>
        <Link className="button quiet" href="/login">Sign in</Link>
      </div>
      <p className="meta">Master desk and portal admins sign in with the seeded addresses in the README.</p>
    </Phone>
  )
}
