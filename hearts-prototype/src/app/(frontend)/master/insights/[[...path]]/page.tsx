import { requireMaster } from '@/server/context'
import { InsightPages } from '@/screens/desk/insights'

export default async function MasterInsights({ params, searchParams }: { params: Promise<{ path?: string[] }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ path = [] }, query] = await Promise.all([params, searchParams])
  const { payload, user } = await requireMaster()
  return InsightPages({ master: { payload, user, query }, path })
}
