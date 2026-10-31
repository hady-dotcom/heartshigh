import { notFound } from 'next/navigation'
import { requireMaster } from '@/server/context'
import { MasterTier, MasterTiers } from '@/screens/desk/tiers'

export default async function Tiers({ params, searchParams }: { params: Promise<{ id?: string[] }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ id = [] }, query] = await Promise.all([params, searchParams])
  const { payload, user } = await requireMaster()
  if (!id.length) return MasterTiers({ payload, user, query })
  if (id.length > 1 || !Number(id[0])) notFound()
  return MasterTier({ payload, user, query }, Number(id[0]))
}
