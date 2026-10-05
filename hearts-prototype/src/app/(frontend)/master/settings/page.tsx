import { requireMaster } from '@/server/context'
import { MasterSettings } from '@/screens/desk/master-settings'

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const query = await searchParams
  const { payload, user } = await requireMaster()
  return MasterSettings({ payload, user, query })
}
