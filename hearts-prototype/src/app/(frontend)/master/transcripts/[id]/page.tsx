import { notFound } from 'next/navigation'
import { requireMaster } from '@/server/context'
import { TranscriptEditScreen } from '@/screens/desk/transcript-edit'

export default async function TranscriptEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; notice?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const lessonId = Number(id)
  if (!lessonId) notFound()
  const { payload, user } = await requireMaster()
  const screen = await TranscriptEditScreen({ payload, user, query, id: lessonId })
  if (!screen) notFound()
  return screen
}
