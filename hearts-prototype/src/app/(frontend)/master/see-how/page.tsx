import { requireMaster } from '@/server/context'
import { MasterSeeHowScreen } from '@/screens/desk/see-how'

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const query = await searchParams
  const { payload, user } = await requireMaster()
  return MasterSeeHowScreen({ payload, user, query })
}
