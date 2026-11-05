import { requireMaster } from '@/server/context'
import { MasterOpening } from '@/screens/desk/opening'

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams
  const { payload, user } = await requireMaster()
  return MasterOpening({ payload, user, query })
}
