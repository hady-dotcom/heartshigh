import { NextResponse } from 'next/server'
import { bringInNote, cleanedTimedTranscript, isAwaitingTranscript } from '@/lib/youtube'
import { hashHelperToken, helperRateOk, helperTokenAllows, helperTokenMatches } from '@/lib/helper-token'
import { getSession } from '@/server/context'

export const dynamic = 'force-dynamic'

type Gate =
  | { ok: true; payload: Awaited<ReturnType<typeof getSession>>['payload']; via: 'master' | 'helper' }
  | { ok: false; response: NextResponse }

async function gate(req: Request): Promise<Gate> {
  const url = new URL(req.url)
  const { payload, user } = await getSession()
  if (user?.role === 'master') return { ok: true, payload, via: 'master' }
  const header = req.headers.get('authorization') || ''
  const secret = header.replace(/^Bearer\s+/i, '').trim()
  if (!secret) return { ok: false, response: NextResponse.json({ error: 'Sign in on the master desk first.' }, { status: 401 }) }
  if (!helperTokenAllows(req.method, url.pathname)) {
    return { ok: false, response: NextResponse.json({ error: 'This token can only list talks that are waiting for a transcript and attach a transcript.' }, { status: 403 }) }
  }
  const found = await payload.find({
    collection: 'helper-tokens',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { tokenHash: { equals: hashHelperToken(secret) } },
  })
  const row = found.docs[0] as { id: number; revokedAt?: string | null; tokenHash?: string } | undefined
  if (!row || row.revokedAt || !helperTokenMatches(secret, String(row.tokenHash || ''))) {
    return { ok: false, response: NextResponse.json({ error: 'That helper token is not valid.' }, { status: 401 }) }
  }
  if (!helperRateOk(row.id)) {
    return { ok: false, response: NextResponse.json({ error: 'Too many helper calls. Wait a minute and try again.' }, { status: 429 }) }
  }
  await payload.update({ collection: 'helper-tokens', id: row.id, overrideAccess: true, data: { lastUsedAt: new Date().toISOString() } as never }).catch(() => undefined)
  return { ok: true, payload, via: 'helper' }
}

/** Talks a helper can fill. Master session or a helper token. */
export async function GET(req: Request) {
  const allowed = await gate(req)
  if (!allowed.ok) return allowed.response
  const found = await allowed.payload.find({
    collection: 'lessons',
    overrideAccess: true,
    depth: 0,
    limit: 200,
    where: { transcriptNote: { like: 'Bring-in: waiting' } },
  })
  const talks = found.docs
    .filter((row) => isAwaitingTranscript(String((row as { transcriptNote?: string }).transcriptNote || '')))
    .map((row) => {
      const lesson = row as { id: number; title?: string; course?: unknown; youtubeId?: string; transcriptNote?: string; durationSeconds?: number; publishState?: string }
      const course = typeof lesson.course === 'object' && lesson.course ? (lesson.course as { id?: number }).id : lesson.course
      return {
        id: lesson.id,
        title: lesson.title || '',
        courseId: typeof course === 'number' ? course : null,
        youtubeId: lesson.youtubeId || '',
        durationSeconds: lesson.durationSeconds || 0,
        note: lesson.transcriptNote || '',
        publishState: lesson.publishState || 'published',
      }
    })
  return NextResponse.json({ talks })
}

/** Attach a timed transcript to one waiting talk. Body: { lesson, transcript }. Does not publish. */
export async function POST(req: Request) {
  const allowed = await gate(req)
  if (!allowed.ok) return allowed.response
  const body = (await req.json().catch(() => null)) as { lesson?: number; transcript?: string; publish?: boolean } | null
  if (body && 'publish' in body && body.publish) {
    return NextResponse.json({ error: 'This token cannot publish a talk.' }, { status: 403 })
  }
  const lessonId = Number(body?.lesson || 0)
  const raw = String(body?.transcript || '')
  if (!lessonId || !raw.trim()) return NextResponse.json({ error: 'Send a lesson id and a timed transcript.' }, { status: 400 })
  const lesson = await allowed.payload.findByID({ collection: 'lessons', id: lessonId, depth: 0, overrideAccess: true }).catch(() => null) as { transcriptNote?: string; publishState?: string | null } | null
  if (!lesson) return NextResponse.json({ error: 'That talk could not be found.' }, { status: 404 })
  if (!isAwaitingTranscript(lesson.transcriptNote)) return NextResponse.json({ error: 'That talk is not waiting for a transcript.' }, { status: 409 })
  const stored = cleanedTimedTranscript(raw)
  await allowed.payload.update({
    collection: 'lessons',
    id: lessonId,
    overrideAccess: true,
    data: {
      transcript: stored.cleaned,
      transcriptSource: 'upload',
      transcriptNote: bringInNote('processed', allowed.via === 'helper' ? 'A timed transcript was attached by the caption helper.' : 'A timed transcript was attached by the waiting-transcript API.'),
      publishState: lesson.publishState === 'draft' ? 'draft' : 'published',
    },
  })
  return NextResponse.json({
    ok: true,
    lesson: lessonId,
    publishState: lesson.publishState === 'draft' ? 'draft' : lesson.publishState || 'published',
    learnersCanSee: lesson.publishState !== 'draft',
  })
}
