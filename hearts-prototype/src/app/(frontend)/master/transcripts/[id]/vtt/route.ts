import { requireMaster } from '@/server/context'
import { vttDownload } from '@/server/transcript-desk'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lessonId = Number(id)
  const { payload } = await requireMaster()
  const lesson = lessonId
    ? await payload.findByID({ collection: 'lessons', id: lessonId, depth: 0, overrideAccess: true }).catch(() => null)
    : null
  if (!lesson) return new Response('That talk was not found.', { status: 404 })
  const title = typeof lesson.title === 'string' ? lesson.title : 'transcript'
  const transcript = typeof lesson.transcript === 'string' ? lesson.transcript : ''
  const file = vttDownload(transcript, title)
  return new Response(file.body, {
    headers: {
      'Content-Type': 'text/vtt; charset=utf-8',
      'Content-Disposition': `attachment; filename="${file.file}"`,
    },
  })
}
