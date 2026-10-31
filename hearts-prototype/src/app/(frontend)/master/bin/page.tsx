import { requireMaster } from '@/server/context'
import { MasterBin } from '@/screens/desk/bin'

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { payload, user } = await requireMaster()
  return MasterBin({ payload, user, query: await searchParams })
}
