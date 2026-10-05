import { requireMaster } from '@/server/context'
import { SystemScreen } from '@/screens/desk/system'

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams
  const { payload, user } = await requireMaster()
  return SystemScreen({ payload, user, query })
}
