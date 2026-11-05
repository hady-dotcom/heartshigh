import { requireMaster } from '@/server/context'
import { PortalCreateScreen } from '@/screens/desk/portal-studio-screen'

export default async function CreatePortal({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const query = await searchParams
  const { payload, user } = await requireMaster()
  return PortalCreateScreen({ payload, user, query })
}
