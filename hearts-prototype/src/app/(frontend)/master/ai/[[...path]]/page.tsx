import { requireMaster } from '@/server/context'
import { AiPages } from '@/screens/desk/ai'

export default async function MasterAi({ params, searchParams }: { params: Promise<{ path?: string[] }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ path = [] }, query] = await Promise.all([params, searchParams])
  const { payload, user } = await requireMaster()
  return AiPages({ master: { payload, user, query }, path })
}
