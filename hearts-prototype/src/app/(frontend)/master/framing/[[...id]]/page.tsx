import { notFound } from 'next/navigation'
import { requireMaster } from '@/server/context'
import { MasterFramingClip, MasterFramingList } from '@/screens/desk/framing'

export default async function FramingPage({ params, searchParams }: { params: Promise<{ id?: string[] }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ id = [] }, query] = await Promise.all([params, searchParams])
  const { payload, user } = await requireMaster()
  if (!id.length) return MasterFramingList({ payload, user, query })
  if (id.length > 1 || !Number(id[0])) notFound()
  return MasterFramingClip({ payload, user, query }, Number(id[0]))
}
