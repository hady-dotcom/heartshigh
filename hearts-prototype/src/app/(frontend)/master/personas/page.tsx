import { requireMaster } from '@/server/context'
import { MasterPersonas } from '@/screens/desk/personas'

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams
  const { payload, user } = await requireMaster()
  return MasterPersonas({ payload, user, query })
}
