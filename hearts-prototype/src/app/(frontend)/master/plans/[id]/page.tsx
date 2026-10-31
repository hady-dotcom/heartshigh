import { notFound } from 'next/navigation'
import { MasterPlanDetail } from '@/screens/desk/learner-desk'
import { requireMaster } from '@/server/context'
import type { Query } from '@/screens/common'

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  const { id } = await params
  if (!Number(id)) notFound()
  const { payload, user } = await requireMaster()
  return MasterPlanDetail({ payload, user, query: await searchParams }, Number(id))
}
