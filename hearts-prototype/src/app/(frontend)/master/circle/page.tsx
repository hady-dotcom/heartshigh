import { requireMaster } from '@/server/context'
import { MasterCircle } from '@/screens/desk/circle'

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams
  const { payload, user } = await requireMaster()
  return MasterCircle({ payload, user, query })
}
