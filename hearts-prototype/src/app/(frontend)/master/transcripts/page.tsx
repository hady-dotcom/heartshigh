import { requireMaster } from '@/server/context'
import { TranscriptsScreen } from '@/screens/desk/transcripts'

export default async function TranscriptsPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string; q?: string; missing?: string; untimed?: string; short?: string }> }) {
  const query = await searchParams
  const { payload, user } = await requireMaster()
  return TranscriptsScreen({ payload, user, query })
}
