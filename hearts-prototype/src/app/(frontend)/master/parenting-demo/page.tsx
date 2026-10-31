import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isDemoRole } from '@/lib/parenting-demo'
import { demoUser, loadDemoRoom } from '@/server/parenting-demo'
import { getSession } from '@/server/context'
import { ParentingDemoMaster } from '@/screens/desk/parenting-demo-master'
import '../../demo/demo.css'

export const dynamic = 'force-dynamic'

export default async function ParentingDemoMasterPage({ searchParams }: { searchParams: Promise<{ demo?: string; as?: string; part?: string; error?: string; notice?: string }> }) {
  const query = await searchParams
  const { payload } = await getSession()
  const room = await loadDemoRoom(payload, String(query.demo || ''))
  if (!room) {
    if (query.demo) notFound()
    return (
      <main className="parenting-cast" data-testid="parenting-demo-empty">
        <header className="parenting-cast-bar" data-testid="demo-bar"><b>Practice room</b></header>
        <p className="parenting-demo-kicker">Practice room</p>
        <h1>Open a practice room</h1>
        <p>This desk follows a practice room. Start one from the demo board, then come back. Real portals are not listed here.</p>
        <p><Link href="/demo">Open the demo board</Link></p>
      </main>
    )
  }
  const role = isDemoRole(query.as) ? query.as : 'master'
  const user = demoUser('master', room.cast, 0)
  return (
    <ParentingDemoMaster
      ctx={{ payload, user, query }}
      demo={{ token: room.token, role, cast: room.cast, state: room.state }}
    />
  )
}
