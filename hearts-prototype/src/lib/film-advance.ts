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

/**
 * Prefer a host that already holds this spec (cued at startSeconds).
 * Otherwise stay on the visible iframe and load the new id there.
 */
export function planFilmAdvance(visible: 0 | 1, specKey: string, hosts: [HostHold, HostHold]): FilmAdvance {
  const other: 0 | 1 = visible === 0 ? 1 : 0
  if (hosts[other].hasPlayer && hosts[other].key === specKey) return { target: other, action: 'play' }
  if (hosts[visible].hasPlayer && hosts[visible].key === specKey) return { target: visible, action: 'play' }
  if (hosts[visible].hasPlayer) return { target: visible, action: 'load' }
  if (hosts[other].hasPlayer) return { target: other, action: playbackAction(hosts[other], specKey) }
  return { target: visible, action: 'create' }
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

export type ClipEndStep = { kind: 'advance'; next: number } | { kind: 'lane-end' }

/**
 * What follows a clip that has ended. It is the same for a guest and a signed-in
 * learner: the next clip plays, or the lane-end card shows. No sign-up sheet waits in between.
 */
export function afterClipEnds(input: { nextIndex: number | null }): ClipEndStep {
  return input.nextIndex == null ? { kind: 'lane-end' } : { kind: 'advance', next: input.nextIndex }
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

/** State 1 with a frozen clock for this long is a seek/buffer stall, not real playback. */
export const STALL_MS = 500

export function clockIsStalled(input: {
  state: number
  currentTime: number
  lastTime: number
  lastSeenAt: number
  now: number
  stallMs?: number
}) {
  if (input.state !== 1 || input.lastTime < 0) return false
  const frozen = Math.abs(input.currentTime - input.lastTime) < 0.05
  if (!frozen) return false
  return input.now - input.lastSeenAt >= (input.stallMs ?? STALL_MS)
}

export function playbackAdvancing(input: { state: number; currentTime: number; lastTime: number; start?: number }) {
  return (
    input.state === 1 &&
    input.lastTime >= 0 &&
    input.currentTime > input.lastTime + 0.04 &&
    input.currentTime >= (input.start ?? 0) + 0.12
  )
}

export type LiveTapIntent = 'pause' | 'play' | 'hold-pause' | 'none'

/** Pause vs play from live YouTube state plus a moving clock. Never from a cached flag. */
export function livePictureTap(input: { state: number; stalled: boolean }): LiveTapIntent {
  if (input.stalled || input.state === 1 || input.state === 3) return 'pause'
  if (input.state === 2 || input.state === 5) return 'play'
  return 'none'
}

export function applyPauseWhenReady(input: { pauseWhenReady: boolean; advancing: boolean }) {
  return input.pauseWhenReady && input.advancing
}

/** Keep calling pauseVideo on the visible host until YouTube itself reports PAUSED. */
export function keepVisiblePaused(input: { userPaused: boolean; liveState: number; wantsPlay?: boolean }) {
  if (input.wantsPlay || !input.userPaused) return false
  return input.liveState !== 2 && input.liveState !== 0 && input.liveState !== 5
}

/**
 * Auto-advance prefers the hidden host already cued at startSeconds.
 * A tap within 1s of that swap pauses the new visible host and shows the icon.
 */
export function swapThenEarlyTap(input: {
  fromVisible?: 0 | 1
  currentKey?: string
  nextKey?: string
  tapAtMs?: number
  start?: number
} = {}) {
  const fromVisible = input.fromVisible ?? 0
  const currentKey = input.currentKey ?? '4:hors'
  const nextKey = input.nextKey ?? '5:hors'
  const tapAtMs = input.tapAtMs ?? 800
  const start = input.start ?? 254.7
  const hosts: [HostHold, HostHold] = fromVisible === 0
    ? [{ key: currentKey, hasPlayer: true }, { key: nextKey, hasPlayer: true }]
    : [{ key: nextKey, hasPlayer: true }, { key: currentKey, hasPlayer: true }]
  const plan = planFilmAdvance(fromVisible, nextKey, hosts)
  const action = livePictureTap({
    state: 1,
    stalled: clockIsStalled({
      state: 1,
      currentTime: start,
      lastTime: start,
      lastSeenAt: 0,
      now: tapAtMs,
    }),
  })
  const paused = action === 'pause' || action === 'hold-pause'
  return {
    visible: plan.target,
    swapped: plan.target !== fromVisible,
    action,
    state: paused ? 2 : 1,
    icon: paused,
    cover: true,
    readoutHost: plan.target,
  }
}

/**
 * Stall ticks, optional taps, then a moving clock.
 * A stall tap pauses once playback starts. A later tap is a fresh live read.
 */
export function stallThenTap(ticks: Array<{ state: number; cur: number; atMs: number; tap?: boolean }>) {
  let lastTime = -1
  let lastSeenAt = 0
  let pauseWhenReady = false
  let paused = false
  let taps = 0
  let pauseApplies = 0
  let playApplies = 0
  for (const tick of ticks) {
    const stalled = clockIsStalled({
      state: tick.state,
      currentTime: tick.cur,
      lastTime: lastTime < 0 ? tick.cur : lastTime,
      lastSeenAt,
      now: tick.atMs,
    })
    const advancing = playbackAdvancing({ state: tick.state, currentTime: tick.cur, lastTime })
    if (applyPauseWhenReady({ pauseWhenReady, advancing })) {
      paused = true
      pauseWhenReady = false
      pauseApplies += 1
      lastTime = tick.cur
      lastSeenAt = tick.atMs
      continue
    }
    if (tick.tap) {
      taps += 1
      const action = livePictureTap({ state: paused ? 2 : tick.state, stalled })
      if (action === 'pause' || action === 'hold-pause') {
        paused = true
        pauseWhenReady = false
        pauseApplies += 1
      } else if (action === 'play') {
        paused = false
        pauseWhenReady = false
        playApplies += 1
      }
    }
    if (lastTime < 0 || Math.abs(tick.cur - lastTime) >= 0.05) {
      lastTime = tick.cur
      lastSeenAt = tick.atMs
    }
  }
  return { paused, taps, pauseApplies, playApplies }
}

export function endCardPlayerAction(input: { endCard: boolean; state: number }): 'pause' | 'none' {
  if (!input.endCard) return 'none'
  if (input.state === 0 || input.state === 2 || input.state === 5) return 'none'
  return 'pause'
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
