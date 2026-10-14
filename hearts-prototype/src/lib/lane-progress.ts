// Progress for one learner lane. Lane ids stay in opening-data (`LANES[].key`).
// Garden branches and the learner route `/lanes/[id]` both use those ids.
// Pure module: no server imports, so the phone, the desk and the tests can share it.
import { LANES } from './opening-data'

/** A talk or clip in lane order. `start` and `end` are its window inside the talk, in seconds. */
export type LaneProgressClip = {
  cutId: number
  lessonId: number
  start?: number
  end?: number
  /** Whole-talk length, used when a finished talk has no watch-session row. */
  durationSeconds?: number
}

/** Real learner rows. Several sessions for one talk keep the furthest second. */
export type LaneWatch = {
  completions?: { lessonId: number; percent: number }[]
  sessions?: { lessonId: number; seconds: number }[]
  durations?: { lessonId: number; seconds: number }[]
}

export type LaneProgress = {
  laneId: string
  title: string
  found: boolean
  done: number
  total: number
  /** Minutes watched. Garden branches read this name. */
  minutes: number
  minutesWatched: number
  /** "4 of 12 done" */
  line: string
  /** "18 minutes watched" */
  minutesLabel: string
  /** 0 to 1, for the bar. */
  ratio: number
  /** First clip that is not finished. Null when the lane is empty or every clip is done. */
  nextCutId: number | null
  /** Where Continue or Start opens. The next unfinished clip, or the first clip when the lane is finished. */
  playCutId: number | null
  /** True once this learner has finished a clip or any minutes are on record. */
  started: boolean
  /** Cut ids that count as watched, in lane order. */
  doneCutIds: number[]
}

/** The labelled sample shown when a learner has not started a lane. Not a real record. */
export const LANE_PROGRESS_EXAMPLE = {
  done: 4,
  total: 12,
  minutes: 18,
  minutesWatched: 18,
  line: '4 of 12 done',
  minutesLabel: '18 minutes watched',
  ratio: 4 / 12,
} as const

const DONE_PERCENT = 90
const LANE_ID = /^[a-z][a-z-]{1,39}$/

export function isLaneId(laneId: string) {
  return LANES.some((lane) => lane.key === laneId)
}

export function doneLine(done: number, total: number) {
  return `${done} of ${total} done`
}

export function minutesWatchedLabel(minutes: number, seconds = 0) {
  const count = Math.max(0, Math.round(minutes))
  if (count <= 0 && seconds > 0) return 'Under a minute watched'
  return count === 1 ? '1 minute watched' : `${count} minutes watched`
}

/** Learner path for one lane. `base` is `/p/:slug`. */
export function lanePagePath(base: string, laneId: string) {
  return `${base}/lanes/${encodeURIComponent(laneId)}`
}

/** Opens the player on one clip and sends Back to that lane's page. */
export function lanePlayPath(base: string, laneId: string, cutId: number) {
  return `${base}/feed?lane=${encodeURIComponent(laneId)}&clip=${cutId}&from=lane`
}

/**
 * Back target when a clip was opened from a lane page.
 * Null keeps the player's ordinary back (Home, or the mixed feed).
 */
export function feedBackHref(base: string, query: { from?: string | null; lane?: string | null }) {
  const lane = query.lane || ''
  if (query.from !== 'lane' || !LANE_ID.test(lane)) return null
  return lanePagePath(base, lane)
}

function maxByLesson(rows: { lessonId: number; value: number }[]) {
  const out = new Map<number, number>()
  for (const row of rows) {
    if (!row.lessonId || !Number.isFinite(row.value)) continue
    out.set(row.lessonId, Math.max(out.get(row.lessonId) || 0, row.value))
  }
  return out
}

function clipDone(clip: LaneProgressClip, percent: number, seconds: number) {
  if (percent >= DONE_PERCENT) return true
  const end = Number(clip.end || 0)
  const start = Number(clip.start || 0)
  return end > start && seconds >= end - 1
}

/**
 * How far one learner is along a lane.
 * `clips` are that lane's talks in play order. `watch` is their real completions and watch sessions.
 * Call `getLaneProgress(laneId)` alone to read the lane's name. With no clips yet, `total` is the lane's door count
 * so a Garden branch still has a length. Pass clips and watch for the real count.
 */
export function getLaneProgress(laneId: string, clips: LaneProgressClip[] = [], watch: LaneWatch = {}): LaneProgress {
  const known = LANES.find((lane) => lane.key === laneId)
  const list = clips.filter((clip) => clip.cutId && clip.lessonId)
  const percentOf = maxByLesson((watch.completions || []).map((row) => ({ lessonId: row.lessonId, value: Number(row.percent) })))
  const secondsOf = maxByLesson((watch.sessions || []).map((row) => ({ lessonId: row.lessonId, value: Number(row.seconds) })))
  const durationOf = maxByLesson([
    ...(watch.durations || []).map((row) => ({ lessonId: row.lessonId, value: Number(row.seconds) })),
    ...list.map((clip) => ({ lessonId: clip.lessonId, value: Number(clip.durationSeconds || 0) })),
  ])
  const doneFlags = list.map((clip) => clipDone(clip, percentOf.get(clip.lessonId) || 0, secondsOf.get(clip.lessonId) || 0))
  const done = doneFlags.filter(Boolean).length
  const clipTotal = list.length
  const total = clipTotal || (clips.length ? 0 : Math.max(known ? 1 : 0, known?.doors?.length || 0))
  const lessons = [...new Set(list.map((clip) => clip.lessonId))]
  let watchedSeconds = 0
  for (const lessonId of lessons) {
    const fromSession = secondsOf.get(lessonId) || 0
    const percent = percentOf.get(lessonId) || 0
    const duration = durationOf.get(lessonId) || 0
    const fromCompletion = duration > 0 ? (duration * Math.min(100, Math.max(0, percent))) / 100 : 0
    watchedSeconds += Math.max(fromSession, fromCompletion)
  }
  const minutesWatched = Math.round(watchedSeconds / 60)
  const next = list.find((_, index) => !doneFlags[index])
  const play = next || list[0]
  return {
    laneId,
    title: known?.title || '',
    found: Boolean(known),
    done,
    total,
    minutes: minutesWatched,
    minutesWatched,
    line: doneLine(done, total),
    minutesLabel: minutesWatchedLabel(minutesWatched, watchedSeconds),
    ratio: total ? done / total : 0,
    nextCutId: next ? next.cutId : null,
    playCutId: play ? play.cutId : null,
    started: done > 0 || watchedSeconds > 0,
    doneCutIds: list.filter((_, index) => doneFlags[index]).map((clip) => clip.cutId),
  }
}
