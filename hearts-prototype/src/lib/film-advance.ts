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
/** Pointer travel under this is always a tap, never a swipe. */
export const PICTURE_TAP_PX = 10

/** True only for a vertical swipe of 40px or more. A tap or a short flick stays a tap. */
export function pictureSwipeCommit(dx: number, dy: number, minPx = PICTURE_SWIPE_PX) {
  return Math.abs(dy) > Math.abs(dx) && Math.abs(dy) >= minPx
}

/** dy under 10px, or any move that is not a 40px vertical swipe, is a tap. */
export function pictureIsTap(dx: number, dy: number, tapPx = PICTURE_TAP_PX) {
  if (Math.hypot(dx, dy) < tapPx) return true
  return !pictureSwipeCommit(dx, dy)
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

export type EndAdvanceSource = 'window' | 'state0'

/**
 * One clip may advance the feed once. The hors-window poll is the primary
 * end; YouTube state 0 is only a fallback when that poll did not fire.
 * After an advance, further ends wait until the new clip reports PLAYING.
 */
export function takeEndAdvance(input: {
  clipKey: string
  advancedFrom: string | null
  newClipPlaying: boolean
  source: EndAdvanceSource
  windowHandled: boolean
}): { take: boolean; advancedFrom: string | null } {
  if (!input.clipKey) return { take: false, advancedFrom: input.advancedFrom }
  if (input.advancedFrom === input.clipKey) return { take: false, advancedFrom: input.advancedFrom }
  if (!input.newClipPlaying) return { take: false, advancedFrom: input.advancedFrom }
  if (input.source === 'state0' && input.windowHandled) return { take: false, advancedFrom: input.advancedFrom }
  return { take: true, advancedFrom: input.clipKey }
}

export type EndAdvanceSignal = {
  source: EndAdvanceSource
  clipKey?: string
  atMs?: number
}

/**
 * Window-end and state 0 for the same clip, even 300ms apart, step once.
 * A leftover end on the clip we just landed on must not skip to N+2.
 */
export function feedAfterEndSignals(input: {
  length: number
  index: number
  signals: Array<EndAdvanceSource | EndAdvanceSignal>
}): { index: number; endCard: boolean; lastState: number } {
  let advancedFrom: string | null = null
  let newClipPlaying = true
  let windowHandled = false
  let index = input.index
  let endCard = false
  let lastState = 1

  const rows = input.signals
    .map((row) => (typeof row === 'string' ? { source: row } : row))
    .sort((a, b) => (a.atMs ?? 0) - (b.atMs ?? 0))

  for (const row of rows) {
    const clipKey = row.clipKey ?? String(index)
    const decision = takeEndAdvance({
      clipKey,
      advancedFrom,
      newClipPlaying,
      source: row.source,
      windowHandled,
    })
    if (!decision.take) continue
    advancedFrom = decision.advancedFrom
    if (row.source === 'window') windowHandled = true
    const next = index + 1
    if (next >= input.length) {
      endCard = true
      lastState = 0
      continue
    }
    index = next
    newClipPlaying = false
    windowHandled = false
    lastState = -1
  }

  if (!endCard && lastState === -1) lastState = 1
  return { index, endCard, lastState }
}

/** A tap pauses PLAYING or BUFFERING. It must not seek or reload. */
export function pictureTapAction(state: number | null | undefined): 'pause' | 'play' | 'none' {
  if (state === 1 || state === 3) return 'pause'
  if (state === 2 || state === 5) return 'play'
  return 'none'
}

/** One seek+play after the film has sat in BUFFERING for this long. */
export const BUFFER_RETRY_MS = 6000

export function bufferRetryAction(input: {
  bufferingForMs: number
  state: number
  alreadyRetried: boolean
}): 'wait' | 'retry' | 'none' {
  if (input.state !== 3) return 'none'
  if (input.alreadyRetried) return 'wait'
  if (input.bufferingForMs < BUFFER_RETRY_MS) return 'wait'
  return 'retry'
}
