import { requireMaster } from '@/server/context'
import { MasterTrashScreen } from '@/screens/desk/trash'

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams
  const { payload, user } = await requireMaster()
  return MasterTrashScreen({ payload, user, query })
}
