import { getSession } from '@/server/context'
import { json } from '@/server/api'
import { partTitle } from '@/lib/talk-title'
import { cleanTitle } from '@/lib/clean-title'
import { cutIdFromSaved } from '@/lib/saved'

export const dynamic = 'force-dynamic'

/** Titles for clips saved on this phone. Signed in only; ids are cut-<n>. */
export async function GET(req: Request) {
  const session = await getSession({ touch: false })
  if (!session.user) return json({ error: 'Sign in first.' }, 401)
  const raw = new URL(req.url).searchParams.get('ids') || ''
  const ids = [...new Set(raw.split(',').map((id) => cutIdFromSaved(id.trim()) || Number(id)).filter((id) => Number.isFinite(id) && id > 0))].slice(0, 40)
  if (!ids.length) return json({ titles: {} })
  const found = await session.payload.find({
    collection: 'cuts',
    where: { id: { in: ids } },
    depth: 2,
    limit: 40,
    overrideAccess: true,
  })
  const titles: Record<string, string> = {}
  const talks: Record<string, { talk: string; title: string }> = {}
  for (const cut of found.docs) {
    const lesson = typeof cut.lesson === 'object' && cut.lesson ? cut.lesson as { id?: number; title?: string; sourceTitle?: string; order?: number; youtubeId?: string; vimeoId?: string; course?: { title?: string } | number } : null
    const courseTitle = lesson && typeof lesson.course === 'object' ? lesson.course.title : ''
    const title = cleanTitle(partTitle(lesson, courseTitle) || String(cut.hook || cut.turn || ''))
    const key = `cut-${cut.id}`
    if (title) titles[key] = title
    const talk = lesson?.id ? `lesson-${lesson.id}` : key
    talks[key] = { talk, title: title || key }
  }
  return json({ titles, talks })
}
