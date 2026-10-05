import { requireMaster } from '@/server/context'
import { InsightPages } from '@/screens/desk/insights'

export default async function MasterInsights({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams
  const { payload, user } = await requireMaster()
  return InsightPages({ master: { payload, user, query } })
}
