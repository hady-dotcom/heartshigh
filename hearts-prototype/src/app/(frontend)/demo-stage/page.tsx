import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { DEMO_SLOTS, demoCookieName } from '@/lib/demo-stage'
import { requireMaster } from '@/server/context'
import { BootDemo } from './boot'
import { DemoStage } from './stage'
import './demo-stage.css'

export const dynamic = 'force-dynamic'

export default async function DemoStagePage() {
  if ((await headers()).get('x-demo-slot')) redirect('/master')
  await requireMaster()
  const jar = await cookies()
  const ready = DEMO_SLOTS.every((slot) => jar.get(demoCookieName(slot))?.value)
  if (!ready) return <BootDemo />
  return <DemoStage />
}
