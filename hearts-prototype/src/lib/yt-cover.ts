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
export function coverHoldKey(cutId: number | null | undefined, mode: string) {
  return `${cutId ?? ''}:${mode}`
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

/** One line for `?debug=yt`, always from the live player. */
export function playerReadout(input: { state: number; time: number; currentTime: number; cover: boolean }) {
  return `state ${input.state} time ${input.time.toFixed(1)} cur ${input.currentTime.toFixed(1)} cover ${input.cover ? 'yes' : 'no'}`
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
