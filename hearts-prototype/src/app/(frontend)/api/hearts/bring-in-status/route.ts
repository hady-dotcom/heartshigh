import { NextResponse } from 'next/server'
import { bringInStatus } from '@/lib/youtube'
import { getSession } from '@/server/context'

export const dynamic = 'force-dynamic'

/** Live status for the Bring in desk. A helper token cannot call this. */
export async function GET(req: Request) {
  const header = req.headers.get('authorization') || ''
  if (/^Bearer\s+hlp_/i.test(header)) {
    return NextResponse.json({ error: 'This token can only list talks that are waiting for a transcript and attach a transcript.' }, { status: 403 })
  }
  const { payload, user } = await getSession()
  if (!user || (user.role !== 'master' && user.role !== 'portal-admin')) {
    return NextResponse.json({ error: 'Sign in on the desk first.' }, { status: 401 })
  }
  const ids = [...new Set((new URL(req.url).searchParams.get('ids') || '').split(',').map((value) => Number(value)).filter((id) => id > 0))].slice(0, 80)
  if (!ids.length) return NextResponse.json({ lessons: [] })
  const found = await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: ids.length, where: { id: { in: ids } } })
  const lessons = (found.docs as { id: number; title?: string; transcriptNote?: string; publishState?: string; youtubeId?: string; speaker?: string }[]).map((lesson) => ({
    id: lesson.id,
    title: lesson.title || '',
    youtubeId: lesson.youtubeId || '',
    speaker: lesson.speaker || '',
    publishState: lesson.publishState || 'published',
    status: bringInStatus(lesson.transcriptNote) || '',
    note: lesson.transcriptNote || '',
  }))
  return NextResponse.json({ lessons })
}
