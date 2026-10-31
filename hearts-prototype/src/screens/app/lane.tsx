import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LaneProgressSlot } from '@/components/app/lane-progress'
import { LearnerTabBar } from '@/components/app/learner-bar'
import { AppFrame, Back, Flash } from '@/components/app/shell'
import { learnerBrand } from '@/lib/learner-brand'
import { getLaneProgress, isLaneId, lanePlayPath, type LaneProgressClip, type LaneWatch } from '@/lib/lane-progress'
import { lanesWithClips } from '@/lib/lanes'
import { LANE_BLURBS } from '@/lib/opening-data'
import { learnerWords } from '@/lib/tidy-caption'
import { learnerClips } from '@/server/opening'
import type { FeedItem } from '@/server/learner'
import { shownPoster } from '@/server/learner'
import { type Ctx, ref, rows, unreadCount } from '../common'

const LANE_KEY = /^[a-z][a-z-]{1,39}$/

function clipsOf(clips: FeedItem[]): LaneProgressClip[] {
  return clips.map((clip) => ({
    cutId: clip.cutId,
    lessonId: clip.lessonId,
    start: Number(clip.hors?.start || 0),
    end: Number(clip.hors?.end || 0),
    durationSeconds: Number(clip.talkSeconds || clip.durationSeconds || 0),
  }))
}

export function watchFor(completions: readonly Record<string, unknown>[], sessions: readonly Record<string, unknown>[], clips: FeedItem[]): LaneWatch {
  return {
    completions: completions.flatMap((row) => {
      const lessonId = ref(row.lesson)
      return lessonId ? [{ lessonId, percent: Number(row.percent ?? 100) }] : []
    }),
    sessions: sessions.flatMap((row) => {
      const lessonId = ref(row.lesson)
      return lessonId ? [{ lessonId, seconds: Number(row.seconds || 0) }] : []
    }),
    durations: clipsOf(clips).flatMap((clip) => (clip.durationSeconds ? [{ lessonId: clip.lessonId, seconds: clip.durationSeconds }] : [])),
  }
}

function talkTitle(clip: FeedItem) {
  return learnerWords(clip.lessonTitle || clip.courseTitle || 'A talk')
}

/** One lane: its talks in order, how far you are, and a way back from the film. */
export async function LaneScreen({ payload, user, portal, base, query }: Ctx, laneId: string) {
  if (!LANE_KEY.test(laneId)) notFound()
  const [{ opening }, unread, completions, sessions] = await Promise.all([
    learnerClips(payload, portal, user),
    unreadCount(payload, user),
    rows(payload, 'completions', { user: { equals: user.id } }, { limit: 200 }),
    rows(payload, 'watch-sessions', { user: { equals: user.id } }, { limit: 400 }),
  ])
  const known = isLaneId(laneId) || opening.route.lanes.some((lane) => lane.key === laneId)
  if (!known) notFound()
  const title = opening.laneTitles[laneId] || opening.route.lanes.find((lane) => lane.key === laneId)?.title || laneId
  const lane = lanesWithClips(opening.route, opening.clips, opening.laneTitles).find((row) => row.key === laneId)
  const clips = lane?.clips || []
  const progress = getLaneProgress(laneId, clipsOf(clips), watchFor(completions, sessions, clips))
  const playHref = progress.playCutId ? lanePlayPath(base, laneId, progress.playCutId) : ''
  const doneCuts = new Set(progress.doneCutIds)
  return (
    <AppFrame testId="lane" brand={learnerBrand(portal)}>
      <div className="app-scroll">
        <Back href={`${base}/lanes`} label="Lanes" />
        <div className="app-head">
          <div>
            <h1 data-testid="lane-title">{learnerWords(title)}</h1>
            <p className="page-sub" data-testid="lane-sub">{LANE_BLURBS[laneId] || 'Talks that belong together, in the order to watch them.'}</p>
          </div>
        </div>
        <Flash error={query.error} notice={query.notice} />
        <LaneProgressSlot
          progress={progress}
          startHref={playHref || undefined}
          continueHref={progress.started && playHref ? playHref : undefined}
          continueLabel={progress.nextCutId ? 'Continue' : 'Watch again'}
        />
        <p className="eyebrow">The talks, in order</p>
        <ol className="lane-items" data-testid="lane-items">
          {clips.map((clip, index) => {
            const watched = doneCuts.has(clip.cutId)
            const poster = shownPoster(clip.poster) || shownPoster(clip.portrait)
            return (
              <li key={clip.cutId}>
                <Link
                  className="continue-row"
                  href={lanePlayPath(base, laneId, clip.cutId)}
                  data-testid="lane-item"
                  data-cut={clip.cutId}
                  data-lesson={clip.lessonId}
                  data-done={watched ? 'yes' : 'no'}
                >
                  <span className="thumb" style={poster ? { backgroundImage: `url(${poster})` } : undefined} />
                  <span className="t">
                    <b>{index + 1}. {talkTitle(clip)}</b>
                    <small>{clip.speaker ? `${learnerWords(clip.speaker)} · ` : ''}{watched ? 'Watched' : 'Not yet'}</small>
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      </div>
      <LearnerTabBar base={base} active="lanes" portal={portal} unread={unread} />
    </AppFrame>
  )
}
