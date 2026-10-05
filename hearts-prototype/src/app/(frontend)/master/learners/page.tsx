import { requireMaster } from '@/server/context'
import { MasterPeople } from '@/screens/desk/master-people'

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string; hideTest?: string }> }) {
  const query = await searchParams
  const { payload, user } = await requireMaster()
  return MasterPeople({ payload, user, query })
}
