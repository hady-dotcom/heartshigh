/** How long the app cover stays up after YouTube has really been PLAYING. */
export const YT_CHROME_HOLD_MS = 4500
/** Fade the cover only at the end of the hold. */
export const YT_COVER_FADE_MS = 250
/** If no PLAYING event arrives, poll the player and lift or retry after this. */
export const YT_STATE_FALLBACK_MS = 6000
/** Framing F is uncropped. The cover hides chrome; the iframe shows the full 16:9 frame. */
export const YT_CROP_TOP = 0
export const YT_CROP_BOTTOM = 0

export function coverShouldHold(playingForMs: number, holdMs = YT_CHROME_HOLD_MS) {
  return playingForMs < holdMs
}

/** Never treat a missing start clock as page-uptime. No start means the full hold is still left. */
export function coverHoldMsLeft(playStartedAt: number, now: number, holdMs = YT_CHROME_HOLD_MS) {
  if (!playStartedAt) return holdMs
  return holdMs - (now - playStartedAt)
}

/** Restart the 4.5s hold on every clip or level switch, including auto-advance and swipe. */
export function coverHoldKey(cutId: number | null | undefined, mode: string, specKey?: string | null) {
  return specKey ? `${cutId ?? ''}:${mode}:${specKey}` : `${cutId ?? ''}:${mode}`
}

/**
 * The hold clock starts only on this clip's first confirmed PLAYING.
 * Leftover PLAYING from the film we just left must not start or keep the clock.
 */
export function coverHoldMayStart(input: {
  holdKey: string
  holdFor: string
  specKey?: string | null
  hostSpecKey?: string | null
  state: number
  currentTime: number
  start: number
}) {
  if (!input.holdKey || input.holdFor !== input.holdKey) return false
  if (!input.specKey || input.hostSpecKey !== input.specKey) return false
  return playingConfirmed(input.state, input.currentTime, input.start)
}

/** Restart the hold on buffering, any other state, or a stuck clock. Continuous PLAYING may keep running. */
export function coverHoldShouldRestart(state: number, prevState?: number, timeAdvancing = true) {
  if (state !== 1) return true
  if (prevState != null && prevState !== 1) return true
  return timeAdvancing === false
}

/** Framing F is a true 16:9 contain. No crop, no shift. */
export function filmIframeCrop(_top = YT_CROP_TOP, _bottom = YT_CROP_BOTTOM) {
  return { heightPct: 100, topPct: 0 }
}

/** Cover still for the clip that is loading. Empty when the id is missing so a previous thumb cannot linger. */
export function filmCoverKey(clip: { cutId?: number | null; youtubeId?: string | null } | null | undefined) {
  if (!clip?.youtubeId) return ''
  return `${clip.cutId ?? ''}:${clip.youtubeId}`
}

/** The painted cover and the `?debug=yt` readout share this word. */
export function coverAttr(cover: boolean): 'yes' | 'no' {
  return cover ? 'yes' : 'no'
}

/** One line for `?debug=yt`, always from the live player. */
export function playerReadout(input: { state: number; time: number; currentTime: number; cover: boolean }) {
  return `state ${input.state} time ${input.time.toFixed(1)} cur ${input.currentTime.toFixed(1)} cover ${coverAttr(input.cover)}`
}

/** After a board auto-close on advance, leftover pointer work must not leave the new clip paused. */
export function advanceLeavesPlayable(input: { userPaused: boolean; boardOpen: boolean; swallowUntil: number; now: number }) {
  return !input.userPaused && !input.boardOpen && input.now >= input.swallowUntil
}

/** True when state is PLAYING and the clock has moved past the in-point. */
export function playingConfirmed(state: number, currentTime: number, start = 0) {
  return state === 1 && currentTime >= start + 0.12
}

/** The app cover sits over the band until YouTube has been PLAYING past its own chrome fade. */
export function filmCoverVisible(input: {
  playing: boolean
  playingForMs: number
  paused: boolean
  ended: boolean
  timeAdvancing?: boolean
  blocked?: boolean
  holdMs?: number
}) {
  if (input.blocked || input.ended || input.paused || !input.playing) return true
  if (input.timeAdvancing === false) return true
  return coverShouldHold(input.playingForMs, input.holdMs)
}

/** The small app pause mark. Never on an ended clip — that is an advance or a calm end card. */
export function pauseMarkVisible(input: { paused: boolean; ended: boolean; userPaused: boolean }) {
  return input.userPaused && input.paused && !input.ended
}

/**
 * When onReady/onStateChange never fire, poll getPlayerState/getCurrentTime.
 * treat-playing: the film is actually running. retry: ask playVideo again.
 */
export function coverFallbackAction(input: {
  waitedMs: number
  eventPlaying: boolean
  polledState: number
  polledTime: number
  start?: number
  fallbackMs?: number
}): 'wait' | 'treat-playing' | 'retry' {
  if (playingConfirmed(input.polledState, input.polledTime, input.start || 0)) return 'treat-playing'
  if (input.eventPlaying) return 'wait'
  if (input.waitedMs < (input.fallbackMs ?? YT_STATE_FALLBACK_MS)) return 'wait'
  if (input.polledState === 1) return 'treat-playing'
  return 'retry'
}

/** Landscape still that fills a 16:9 band. Prefer hqdefault so we never wait on maxres. */
export function landscapeThumb(youtubeId: string | null | undefined) {
  if (!youtubeId || !/^[\w-]{11}$/.test(youtubeId)) return null
  return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
}

export function ytDebugOn(search: string) {
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('debug') === 'yt'
}

export type CoverHoldMachine = {
  holdFor: string
  playStartedAt: number
  holdState: number
  lastTime: number
  cover: boolean
}

export function freshCoverHold(): CoverHoldMachine {
  return { holdFor: '', playStartedAt: 0, holdState: -9, lastTime: -1, cover: true }
}

/**
 * One sample of the cover hold. The clock starts on this clip's own PLAYING
 * with cur past the in-point, and it must not reset on later ticks of the same
 * hold. Pause or a new clip key puts the cover back.
 */
export function coverHoldStep(
  machine: CoverHoldMachine,
  tick: {
    holdKey: string
    specKey: string
    hostSpecKey: string
    state: number
    currentTime: number
    start: number
    now: number
    ended?: boolean
    userPaused?: boolean
  },
): CoverHoldMachine {
  let next = machine.holdFor === tick.holdKey ? { ...machine } : freshCoverHold()
  if (next.holdFor !== tick.holdKey) next.holdFor = tick.holdKey
  if (tick.ended || tick.userPaused) {
    return { ...next, playStartedAt: 0, holdState: tick.state, lastTime: tick.currentTime, cover: true }
  }
  const specOk = Boolean(tick.specKey) && tick.specKey === tick.hostSpecKey
  const confirmed = specOk && playingConfirmed(tick.state, tick.currentTime, tick.start)
  if (!confirmed) {
    if (tick.state !== 1) {
      return { ...next, playStartedAt: 0, holdState: tick.state, lastTime: tick.currentTime, cover: true }
    }
    return {
      ...next,
      holdState: tick.state,
      lastTime: tick.currentTime,
      cover: next.playStartedAt ? coverShouldHold(tick.now - next.playStartedAt) : true,
    }
  }
  const advancing = next.lastTime < 0 || tick.currentTime >= next.lastTime
  if (!next.playStartedAt || coverHoldShouldRestart(tick.state, next.holdState, advancing)) {
    next.playStartedAt = tick.now
  }
  next.holdState = tick.state
  next.lastTime = tick.currentTime
  next.cover = filmCoverVisible({
    playing: true,
    playingForMs: Math.max(0, tick.now - next.playStartedAt),
    paused: false,
    ended: false,
    timeAdvancing: advancing,
  })
  return next
}

/** PLAYING ticks every 250ms with cur advancing: cover is down by ~4.75s. */
export function coverAfterPlayingTicks(input: {
  holdKey: string
  specKey: string
  start?: number
  fromTime?: number
  tickMs?: number
  durationMs?: number
  earlyTime?: number
}) {
  const tickMs = input.tickMs ?? 250
  const durationMs = input.durationMs ?? 6000
  const start = input.start ?? 0
  let time = input.fromTime ?? start + 0.2
  let machine = freshCoverHold()
  const coverAt: Array<{ atMs: number; cover: boolean }> = []
  for (let now = 0; now <= durationMs; now += tickMs) {
    const currentTime = now === 0 && input.earlyTime != null ? input.earlyTime : time
    machine = coverHoldStep(machine, {
      holdKey: input.holdKey,
      specKey: input.specKey,
      hostSpecKey: input.specKey,
      state: 1,
      currentTime,
      start,
      now,
    })
    coverAt.push({ atMs: now, cover: machine.cover })
    if (!(now === 0 && input.earlyTime != null)) time += tickMs / 1000
    else time = input.fromTime ?? start + 0.2
  }
  const at4750 = coverAt.find((row) => row.atMs >= 4750) || coverAt[coverAt.length - 1]
  return {
    coverAt,
    coverAt4750: at4750.cover,
    coverAt6000: coverAt[coverAt.length - 1].cover,
    lifted: !at4750.cover,
  }
}
