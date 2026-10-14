import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { forcedPasswordDestination } from '@/lib/password-gate'
import { getSession } from '@/server/context'
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
  return <DemoStage />
}
