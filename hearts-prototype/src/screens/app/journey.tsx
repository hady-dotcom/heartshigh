import { cookies } from 'next/headers'
import type { Payload } from 'payload'
import { InsightTracker } from '@/components/app/insight-tracker'
import { JourneyErrorBoundary } from '@/components/app/error-boundary'
import { PageHelp } from '@/components/app/page-help'
import { Journey } from '@/components/journey/journey'
import { resolveSlots, subjectFrom } from '@/server/experiments'
import { OPENER } from '@/lib/opening-data'
import { now } from '@/lib/clock'
import { idOf } from '@/lib/ids'
import { portalTimeZone } from '@/lib/zone-time'
import type { PortalDoc, SessionUser } from '@/server/context'
import { partTitle } from '@/lib/talk-title'
import { posterFor, shownPoster } from '@/server/learner'
import { loadOpening } from '@/server/opening'
import { loadDoors } from '@/server/doors'
import { doorNumberOfClause } from '@/lib/doors'
import { contextAt, popularTalkIds, resolveContextLabel } from '@/server/calendar'
import { nudgeTalks } from '@/lib/calendar-context'
import { activeMissionCard } from './mission'
import { unreadCount } from '../common'
import { FeedLiveBanner } from '@/components/app/live-banner'
import { homeLive } from '@/server/live'
import { featureOn, featuresOf } from '@/lib/features'

export async function masterFlags(payload: Payload) {
  const flags = (await payload.findGlobal({ slug: 'master-flags', overrideAccess: true }).catch(() => null)) as { popupOverPlayer?: boolean; chromeOverPlayer?: boolean; showUnchecked?: boolean } | null
  return { popupOverPlayer: flags?.popupOverPlayer !== false, chromeOverPlayer: flags?.chromeOverPlayer !== false, showUnchecked: Boolean(flags?.showUnchecked) }
}

async function mainsShelf(payload: Payload) {
  const lanes = await payload.find({ collection: 'lanes', overrideAccess: true, depth: 0, limit: 50 })
  const lessonIds = lanes.docs.flatMap((lane) => ((lane as { starters?: { lesson?: unknown; role?: string }[] }).starters || []).filter((row) => row.role === 'mains').map((row) => idOf(row.lesson))).filter((id): id is number => Boolean(id))
  const lessons = lessonIds.length ? (await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: 50, where: { id: { in: lessonIds } } })).docs : []
  const shelf: Record<string, { courseId: number; lessonId: number; title: string; poster: string | null }> = {}
  for (const lane of lanes.docs as { key?: string; starters?: { lesson?: unknown; role?: string }[] }[]) {
    const lessonId = idOf((lane.starters || []).find((row) => row.role === 'mains')?.lesson)
    const lesson = lessons.find((row) => row.id === lessonId) as { id: number; course?: unknown; title?: string; sourceTitle?: string; order?: number; youtubeId?: string; vimeoId?: string } | undefined
    const courseId = idOf(lesson?.course)
    if (lane.key && lesson && courseId) shelf[lane.key] = { courseId, lessonId: lesson.id, title: partTitle(lesson), poster: shownPoster(posterFor(lesson.youtubeId)) }
  }
  return shelf
}

/** The one continuous learner surface: opener, scenes, the door, and the feed (spec 7 and 7A). */
export async function JourneyScreen({ payload, portal, user, base, initial, viewAs, query = {} }: { payload: Payload; portal: PortalDoc; user: SessionUser | null; base: string; initial: 'opener' | 'help' | 'feed'; viewAs: boolean; query?: Record<string, string | undefined> }) {
  const deviceId = (await cookies()).get('hearts_device')?.value
  const [opening, flags, mains, unread, doors, live, variants] = await Promise.all([
    loadOpening(payload, portal, user),
    masterFlags(payload),
    mainsShelf(payload),
    user ? unreadCount(payload, user) : Promise.resolve(0),
    loadDoors(payload),
    user ? homeLive(payload, portal, user) : Promise.resolve({ live: null, upcoming: [], pollMs: 12_000 }),
    resolveSlots(payload, ['feed-cta-label', 'full-talk-cta-label', 'wide-video-framing'], subjectFrom(user, deviceId, portal.id)),
  ])
  const context = await contextAt(payload, now(), undefined, undefined, portalTimeZone(portal))
  for (const slot of Object.keys(variants)) {
    const view = variants[slot]
    if (view.running && view.label && !/^learn more\b/i.test(view.label)) continue
    const label = await resolveContextLabel(payload, slot, view.payload, context)
    if (label) variants[slot] = { ...view, label, payload: { ...view.payload, label } }
  }
  const popular = await popularTalkIds(payload)
  const titled = opening.route.cuts.map((cut) => ({
    ...cut,
    title: opening.clips[String(cut.id)]?.lessonTitle || opening.clips[String(cut.id)]?.courseTitle || '',
  }))
  opening.route.cuts = nudgeTalks(titled, context, popular, true)
  const mission = user ? await activeMissionCard(payload, portal.id, base) : null
  return (
    <div className="app-stage dusk">
      {initial === 'feed' && user && featureOn(portal, 'live') ? <FeedLiveBanner portal={String(portal.slug)} base={base} session={live.live} /> : null}
      <main className="app dark journey-frame" data-testid={initial === 'feed' ? 'feed-screen' : 'start-screen'}>
        <PageHelp page={initial === 'feed' ? 'feed' : 'start'} />
        <InsightTracker trendsOptIn={Boolean(user?.trendsOptIn)} />
        {mission && initial === 'feed' && featureOn(portal, 'missions') ? <div className="feed-mission" data-testid="feed-mission">{mission}</div> : null}
        <JourneyErrorBoundary homeHref={base}>
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
            startingDoor={doorNumberOfClause(user?.startingClause, doors)}
            flags={flags}
            mains={mains}
            unread={unread}
            lane={typeof query.lane === 'string' && /^[a-z-]{2,40}$/.test(query.lane) ? query.lane : null}
            clip={Number(query.clip) || null}
            play={query.play === 'appetiser' ? 'appetiser' : null}
            afterPlacing={query.after === 'placing'}
            variants={variants}
            features={featuresOf(portal)}
          />
        </JourneyErrorBoundary>
      </main>
    </div>
  )
}
