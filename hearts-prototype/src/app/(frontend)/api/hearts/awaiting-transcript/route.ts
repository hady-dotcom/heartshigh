import { NextResponse } from 'next/server'
import { bringInNote, cleanedTimedTranscript, isAwaitingTranscript } from '@/lib/youtube'
import { getSession } from '@/server/context'

export const dynamic = 'force-dynamic'

function masterOnly(user: { role?: string } | null) {
  return Boolean(user && user.role === 'master')
}

/** Talks a later helper can fill. This round does not fetch them from a home machine. */
export async function GET() {
  const { payload, user } = await getSession()
  if (!masterOnly(user)) return NextResponse.json({ error: 'Sign in on the master desk first.' }, { status: 401 })
  const found = await payload.find({
    collection: 'lessons',
    overrideAccess: true,
    depth: 0,
    limit: 200,
    where: { transcriptNote: { like: 'Bring-in: waiting' } },
  })
  const talks = found.docs
    .filter((row) => isAwaitingTranscript(String((row as { transcriptNote?: string }).transcriptNote || '')))
    .map((row) => {
      const lesson = row as { id: number; title?: string; course?: unknown; youtubeId?: string; transcriptNote?: string; durationSeconds?: number }
      const course = typeof lesson.course === 'object' && lesson.course ? (lesson.course as { id?: number }).id : lesson.course
      return {
        id: lesson.id,
        title: lesson.title || '',
        courseId: typeof course === 'number' ? course : null,
        youtubeId: lesson.youtubeId || '',
        durationSeconds: lesson.durationSeconds || 0,
        note: lesson.transcriptNote || '',
      }
    })
  return NextResponse.json({ talks })
}

/** Attach a timed transcript to one waiting talk. Body: { lesson, transcript }. */
export async function POST(req: Request) {
  const { payload, user } = await getSession()
  if (!masterOnly(user)) return NextResponse.json({ error: 'Sign in on the master desk first.' }, { status: 401 })
  const body = (await req.json().catch(() => null)) as { lesson?: number; transcript?: string } | null
  const lessonId = Number(body?.lesson || 0)
  const raw = String(body?.transcript || '')
  if (!lessonId || !raw.trim()) return NextResponse.json({ error: 'Send a lesson id and a timed transcript.' }, { status: 400 })
  const lesson = await payload.findByID({ collection: 'lessons', id: lessonId, depth: 0, overrideAccess: true }).catch(() => null) as { transcriptNote?: string } | null
  if (!lesson) return NextResponse.json({ error: 'That talk could not be found.' }, { status: 404 })
  if (!isAwaitingTranscript(lesson.transcriptNote)) return NextResponse.json({ error: 'That talk is not waiting for a transcript.' }, { status: 409 })
  const stored = cleanedTimedTranscript(raw)
  await payload.update({
    collection: 'lessons',
    id: lessonId,
    overrideAccess: true,
    data: {
      transcript: stored.cleaned,
      transcriptSource: 'upload',
      transcriptNote: bringInNote('processed', 'A timed transcript was attached by the waiting-transcript API.'),
    },
  })
  return NextResponse.json({ ok: true, lesson: lessonId })
}
