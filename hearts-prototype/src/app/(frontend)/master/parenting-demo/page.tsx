import { notFound } from 'next/navigation'
import { isDemoRole } from '@/lib/parenting-demo'
import { demoUser, loadDemoRoom } from '@/server/parenting-demo'
import { getSession } from '@/server/context'
import { ParentingDemoMaster } from '@/screens/desk/parenting-demo-master'

export const dynamic = 'force-dynamic'

export default async function ParentingDemoMasterPage({ searchParams }: { searchParams: Promise<{ demo?: string; as?: string; part?: string; error?: string; notice?: string }> }) {
  const query = await searchParams
  const { payload } = await getSession()
  const room = await loadDemoRoom(payload, String(query.demo || ''))
  if (!room) notFound()
  const role = isDemoRole(query.as) ? query.as : 'master'
  const user = demoUser('master', room.cast, 0)
  return (
    <ParentingDemoMaster
      ctx={{ payload, user, query }}
      demo={{ token: room.token, role, cast: room.cast, state: room.state }}
    />
  )
}
