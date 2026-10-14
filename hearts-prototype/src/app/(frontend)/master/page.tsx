import { requireMaster } from '@/server/context'
import { MasterPortals } from '@/screens/desk/master'

export default async function Master({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const query = await searchParams
  const { payload, user } = await requireMaster()
  return MasterPortals({ payload, user, query })
}
