import { requireMaster } from '@/server/context'
import { MasterActivityScreen } from '@/screens/desk/activity'

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams
  const { payload, user } = await requireMaster()
  return MasterActivityScreen({ payload, user, query })
}
