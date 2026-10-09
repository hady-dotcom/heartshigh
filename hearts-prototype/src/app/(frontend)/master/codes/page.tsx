import { requireMaster } from '@/server/context'
import { MasterCodes } from '@/screens/desk/extra-pages'

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { payload, user } = await requireMaster()
  return MasterCodes({ payload, user, query: await searchParams })
}
