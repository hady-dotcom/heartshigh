import type { Metadata } from 'next'
import { getSession, loadPortal } from '@/server/context'
import { DemoDoor } from './door'
import './demo-stage.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Hady Core Demo stage',
  description: 'A live four-screen walk-through. Practice data only.',
}

export default async function DemoStagePage() {
  const { payload } = await getSession()
  const demo = await loadPortal(payload, 'hearts-demo')
  const seeded = demo ? null : await loadPortal(payload, 'east-london')
  const slug = demo ? 'hearts-demo' : seeded ? 'east-london' : 'hearts-demo'
  return <DemoDoor learnerSrc={`/p/${slug}/feed`} />
}
