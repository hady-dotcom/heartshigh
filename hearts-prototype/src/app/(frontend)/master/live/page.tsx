import { requireMaster } from '@/server/context'
import { MasterLiveScreen } from '@/screens/desk/live'

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const query = await searchParams
  const { payload, user } = await requireMaster()
  return MasterLiveScreen({ payload, user, query })
}
