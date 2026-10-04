import { requireMaster } from '@/server/context'
import { MasterFraming } from '@/screens/desk/extra-pages'

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { payload, user } = await requireMaster()
  return MasterFraming({ payload, user, query: await searchParams })
}
