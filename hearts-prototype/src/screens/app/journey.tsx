import type { Payload } from 'payload'
import { Journey } from '@/components/journey/journey'
import { OPENER } from '@/lib/opening-data'
import { idOf } from '@/lib/ids'
import type { PortalDoc, SessionUser } from '@/server/context'
import { posterFor } from '@/server/learner'
import { loadOpening } from '@/server/opening'
import { unreadCount } from '../common'

export async function masterFlags(payload: Payload) {
  const flags = (await payload.findGlobal({ slug: 'master-flags', overrideAccess: true }).catch(() => null)) as { popupOverPlayer?: boolean; chromeOverPlayer?: boolean } | null
  return { popupOverPlayer: flags?.popupOverPlayer !== false, chromeOverPlayer: flags?.chromeOverPlayer !== false }
}

async function mainsShelf(payload: Payload) {
  const lanes = await payload.find({ collection: 'lanes', overrideAccess: true, depth: 0, limit: 50 })
  const lessonIds = lanes.docs.flatMap((lane) => ((lane as { starters?: { lesson?: unknown; role?: string }[] }).starters || []).filter((row) => row.role === 'mains').map((row) => idOf(row.lesson))).filter((id): id is number => Boolean(id))
  const lessons = lessonIds.length ? (await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: 50, where: { id: { in: lessonIds } } })).docs : []
  const shelf: Record<string, { courseId: number; lessonId: number; title: string; poster: string | null }> = {}
  for (const lane of lanes.docs as { key?: string; starters?: { lesson?: unknown; role?: string }[] }[]) {
    const lessonId = idOf((lane.starters || []).find((row) => row.role === 'mains')?.lesson)
    const lesson = lessons.find((row) => row.id === lessonId) as { id: number; course?: unknown; title?: string; sourceTitle?: string; youtubeId?: string } | undefined
    const courseId = idOf(lesson?.course)
    if (lane.key && lesson && courseId) shelf[lane.key] = { courseId, lessonId: lesson.id, title: lesson.sourceTitle || lesson.title || '', poster: posterFor(lesson.youtubeId) }
  }
  return shelf
}

/** The one continuous learner surface: opener, six scenes, the door, and the feed (spec 7 and 7A). */
export async function JourneyScreen({ payload, portal, user, base, initial, viewAs }: { payload: Payload; portal: PortalDoc; user: SessionUser | null; base: string; initial: 'opener' | 'help' | 'feed'; viewAs: boolean }) {
  const [opening, flags, mains, unread] = await Promise.all([loadOpening(payload, portal, user), masterFlags(payload), mainsShelf(payload), user ? unreadCount(payload, user) : Promise.resolve(0)])
  return (
    <div className="app-stage dusk">
      <main className="app dark journey-frame" data-testid={initial === 'feed' ? 'feed-screen' : 'start-screen'}>
        <Journey
          base={base}
          opening={opening}
          opener={OPENER}
          initial={initial}
          signedIn={Boolean(user)}
          learner={user?.role === 'learner'}
          viewAs={viewAs}
          keepPlace={Boolean(user?.keepPlace)}
          trendsOptIn={Boolean(user?.trendsOptIn)}
          startingClause={user?.startingClause ?? null}
          flags={flags}
          mains={mains}
          unread={unread}
        />
      </main>
    </div>
  )
}
