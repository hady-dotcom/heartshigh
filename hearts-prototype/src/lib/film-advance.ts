// How the feed starts the next hors d'oeuvre.
// The first clip autoplays because its iframe is created on the visible host.
// A later step used to reveal the preloaded hidden iframe, or cueVideoById and
// playVideo in the same turn. YouTube then sits at 0:00 with its own play button.

export type HostHold = {
  key: string | null
  hasPlayer: boolean
}

export type FilmAdvance = {
  target: 0 | 1
  /** play: this host already has the clip — call playVideo. load: same iframe, new id. create: no player yet. */
  action: 'play' | 'load' | 'create'
}

/** Stay on the iframe that already played. A hidden preload must not take over. */
export function planFilmAdvance(visible: 0 | 1, specKey: string, hosts: [HostHold, HostHold]): FilmAdvance {
  const other: 0 | 1 = visible === 0 ? 1 : 0
  const target: 0 | 1 = hosts[visible].hasPlayer || !hosts[other].hasPlayer ? visible : other
  return { target, action: playbackAction(hosts[target], specKey) }
}

export function playbackAction(hold: HostHold, specKey: string): FilmAdvance['action'] {
  if (!hold.hasPlayer) return 'create'
  if (hold.key === specKey) return 'play'
  return 'load'
}

/** UNSTARTED, PAUSED, CUED. ENDED is not stuck — the feed moves on. BUFFERING is left alone. */
const STUCK = new Set([-1, 2, 5])

/** Keep asking for several seconds. Five quick tries (~1s) gave up while YouTube was still settling on CUED. */
export const PLAY_NUDGE_FOR_MS = 8000
export const PLAY_NUDGE_EVERY_MS = 400

export function shouldNudgePlay(state: number, armed: boolean, userPaused: boolean, elapsedMs: number, limitMs = PLAY_NUDGE_FOR_MS) {
  return armed && !userPaused && elapsedMs < limitMs && STUCK.has(state)
}

/** A prepare from an older Next must not load over the clip the learner just stepped to. */
export function prepareIsCurrent(stamp: number, current: number) {
  return stamp === current
}

/**
 * The host we are asking to play must stay visibility:visible, including the moment
 * before its spec catches up. Hiding it for that frame makes playVideo land while
 * the iframe is visibility:hidden, and YouTube then sits cued at 0:00.
 * A parked host, a scene card, or an unrevealed feed stays hidden.
 */
export function hostShouldShow(isChosen: boolean, revealed: boolean, blocked: boolean) {
  return isChosen && revealed && !blocked
}

/** Swipe up steps the hors d'oeuvre order. Swipe down still changes lane. */
export function verticalSwipe(dy: number): 'next' | 'lane' {
  return dy < 0 ? 'next' : 'lane'
}

/** A tap on the picture never skips. Only a vertical swipe of this many pixels does. */
export const PICTURE_SWIPE_PX = 40

/** True only for a vertical swipe of 40px or more. A tap or a short flick stays a tap. */
export function pictureSwipeCommit(dx: number, dy: number, minPx = PICTURE_SWIPE_PX) {
  return Math.abs(dy) > Math.abs(dx) && Math.abs(dy) >= minPx
}

/** Watch keys are `cut:hors:talk`; player specs are `cut:hors`. */
export function endedKeysMatch(watchKey: string, eventKey?: string | null) {
  if (!eventKey || !watchKey) return false
  if (eventKey === watchKey) return true
  const watchSpec = watchKey.split(':').slice(0, 2).join(':')
  return eventKey === watchSpec || eventKey.startsWith(`${watchSpec}:`)
}

/**
 * A leftover `hearts:ended` from the clip we just left must not run against the
 * clip now on screen. Only this watch's own end (or YouTube state 0 on this spec) counts.
 * An unkeyed event is only trusted when this watch has already marked ended.
 */
export function endedEventIsCurrent(input: {
  watchKey: string
  eventKey?: string | null
  watchEnded: boolean
  playerState?: number
}) {
  if (!input.eventKey) return input.watchEnded
  if (!endedKeysMatch(input.watchKey, input.eventKey)) return false
  return input.watchEnded || input.playerState === 0
}

/** The lane-end card is for a clip that has actually ended, with nowhere else to go. */
export function showLaneEndNow(input: { thisClipEnded: boolean; nextIndex: number | null }) {
  return input.thisClipEnded && input.nextIndex == null
}

/**
 * The last clip's hors window has finished. A leftover clock from the previous
 * film (e.g. 312s on a 0–16s last clip) must not count as this clip's end.
 */
export function horsWindowEnded(time: number, start: number, end: number, slack = 2) {
  return end > start && time >= start - 0.5 && time >= end && time <= end + slack
}
