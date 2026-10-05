import { requireMaster } from '@/server/context'
import { MasterLegalScreen } from '@/screens/desk/legal-desk'

export default async function MasterLegal({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const query = await searchParams
  const { payload, user } = await requireMaster()
  return MasterLegalScreen({ payload, user, query })
}
