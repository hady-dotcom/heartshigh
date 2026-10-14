import { requireMaster } from '@/server/context'
import { MasterPlans } from '@/screens/desk/extra-pages'

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { payload, user } = await requireMaster()
  return MasterPlans({ payload, user, query: await searchParams })
}
