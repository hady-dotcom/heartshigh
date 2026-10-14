import { requireMaster } from '@/server/context'
import { DemoStage } from './stage'
import './demo-stage.css'

export const dynamic = 'force-dynamic'

export default async function DemoStagePage() {
  await requireMaster()
  return <DemoStage />
}
