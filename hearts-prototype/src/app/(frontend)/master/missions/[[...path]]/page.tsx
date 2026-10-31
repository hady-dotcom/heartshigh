import { requireMaster } from '@/server/context'
import { MissionPages } from '@/screens/desk/missions'

export default async function MasterMissions({ params, searchParams }: { params: Promise<{ path?: string[] }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ path = [] }, query] = await Promise.all([params, searchParams])
  const { payload, user } = await requireMaster()
  return MissionPages({ master: { payload, user, query }, path })
}
