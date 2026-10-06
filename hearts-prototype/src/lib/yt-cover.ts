/** How long the app cover stays up after YouTube has really been PLAYING. */
export const YT_CHROME_HOLD_MS = 3000
/** If no PLAYING event arrives, poll the player and lift or retry after this. */
export const YT_STATE_FALLBACK_MS = 6000

export function coverShouldHold(playingForMs: number, holdMs = YT_CHROME_HOLD_MS) {
  return playingForMs < holdMs
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
