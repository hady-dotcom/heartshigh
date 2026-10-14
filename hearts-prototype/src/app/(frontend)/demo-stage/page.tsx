import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { forcedPasswordDestination } from '@/lib/password-gate'
import { getSession, loadPortal } from '@/server/context'
import { DemoStageEntry } from './entry'
import { DemoStage } from './stage'
import './demo-stage.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Hady Core Demo stage',
  description: 'A live four-screen walk-through: master, portal admin, teacher, learner. Practice data only.',
}

export default async function DemoStagePage() {
  const session = await getSession()
  if (!session.user || !session.actor) return <DemoStageEntry />
  const change = forcedPasswordDestination(session.actor, '/demo-stage')
  if (change) redirect(change)
  if (session.user.role !== 'master') redirect('/?other=1')
  const demo = await loadPortal(session.payload, 'hearts-demo')
  const seeded = demo ? null : await loadPortal(session.payload, 'east-london')
  const slug = demo ? 'hearts-demo' : seeded ? 'east-london' : 'hearts-demo'
  return (
    <DemoStage
      sources={{
        master: '/master?stage=1',
        portal: `/p/${slug}/admin?stage=1`,
        teacher: `/p/${slug}/admin/teach?stage=1`,
        learner: `/p/${slug}/feed?stage=1`,
      }}
    />
  )
}
