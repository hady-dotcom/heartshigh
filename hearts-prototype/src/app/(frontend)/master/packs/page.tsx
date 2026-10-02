import { requireMaster } from '@/server/context'
import { MasterPacks } from '@/screens/desk/master'

export default async function Packs({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const query = await searchParams
  const { payload, user } = await requireMaster()
  return MasterPacks({ payload, user, query })
}
