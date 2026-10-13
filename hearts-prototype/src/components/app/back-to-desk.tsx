import Link from 'next/link'
import { staffDeskHref } from '@/lib/landing'
import type { PortalDoc, SessionUser } from '@/server/context'

/** Persistent return for a teacher or portal admin who has stepped into the learner app. */
export function BackToDesk({ user, portal }: { user: SessionUser | null; portal: PortalDoc }) {
  const href = staffDeskHref(user, portal)
  if (!href) return null
  return (
    <Link href={href} className="back-to-desk" data-testid="back-to-desk">
      Back to teacher desk
    </Link>
  )
}
