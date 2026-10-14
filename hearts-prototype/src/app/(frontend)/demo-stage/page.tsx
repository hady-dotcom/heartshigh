import { getSession, loadPortal, requireMaster } from '@/server/context'
import { DemoStage } from './stage'
import './demo-stage.css'

export const dynamic = 'force-dynamic'

export default async function DemoStagePage() {
  const { payload } = await requireMaster()
  const demo = await loadPortal(payload, 'hearts-demo')
  const seeded = demo ? null : await loadPortal(payload, 'east-london')
  const slug = demo ? 'hearts-demo' : seeded ? 'east-london' : 'hearts-demo'
  return <DemoStage learnerSrc={`/p/${slug}/feed`} />
}
