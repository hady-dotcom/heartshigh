import { requireMaster } from '@/server/context'
import { MasterTrends } from '@/screens/desk/opening'

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams
  const { payload, user } = await requireMaster()
  return MasterTrends({ payload, user, query })
}
