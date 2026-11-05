import { MasterDiaries } from '@/screens/desk/learner-desk'
import { requireMaster } from '@/server/context'
import type { Query } from '@/screens/common'

export default async function Page({ searchParams }: { searchParams: Promise<Query> }) {
  const { payload, user } = await requireMaster()
  return MasterDiaries({ payload, user, query: await searchParams })
}
