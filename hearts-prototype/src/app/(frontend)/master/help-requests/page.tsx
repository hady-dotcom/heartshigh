import { requireMaster } from '@/server/context'
import { MasterHelpRequests } from '@/screens/desk/legal-desk'

export default async function MasterHelp({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const query = await searchParams
  const { payload, user } = await requireMaster()
  return MasterHelpRequests({ payload, user, query })
}
