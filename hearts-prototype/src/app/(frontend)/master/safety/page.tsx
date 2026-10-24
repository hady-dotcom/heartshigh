import { requireMaster } from '@/server/context'
import { MasterSafetyScreen } from '@/screens/desk/safety'

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams
  const { payload, user } = await requireMaster()
  return MasterSafetyScreen({ payload, user, query })
}
