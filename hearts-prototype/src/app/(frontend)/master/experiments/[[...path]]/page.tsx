import { requireMaster } from '@/server/context'
import { ExperimentPages } from '@/screens/desk/experiments'

export default async function MasterExperiments({ params, searchParams }: { params: Promise<{ path?: string[] }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ path = [] }, query] = await Promise.all([params, searchParams])
  const { payload, user } = await requireMaster()
  return ExperimentPages({ master: { payload, user, query }, path })
}
