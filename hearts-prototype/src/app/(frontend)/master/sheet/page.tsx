import { requireMaster } from '@/server/context'
import { MasterSheetScreen } from '@/screens/desk/sheet'

export default async function MasterSheet({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string; preview?: string }> }) {
  const query = await searchParams
  const { payload, user } = await requireMaster()
  return MasterSheetScreen({ payload, user, query })
}
