import { requireMaster } from '@/server/context'
import { MasterPeopleScreen } from '@/screens/desk/master-people'

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams
  const { payload, user } = await requireMaster()
  return MasterPeopleScreen({ payload, user, query })
}
