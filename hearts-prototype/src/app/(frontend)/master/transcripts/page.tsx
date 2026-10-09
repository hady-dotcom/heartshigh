import { requireMaster } from '@/server/context'
import { TranscriptFilesScreen } from '@/screens/desk/transcripts'

export default async function TranscriptFilesPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const query = await searchParams
  const { payload, user } = await requireMaster()
  return TranscriptFilesScreen({ payload, user, query })
}
