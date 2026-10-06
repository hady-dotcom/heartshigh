/** How long the app cover stays up after YouTube reports PLAYING, so its fade-in chrome is never seen. */
export const YT_CHROME_HOLD_MS = 1800

export function coverShouldHold(playingForMs: number, holdMs = YT_CHROME_HOLD_MS) {
  return playingForMs < holdMs
}

/** The app cover sits over the band until YouTube has been PLAYING past its own chrome fade. */
export function filmCoverVisible(input: {
  playing: boolean
  playingForMs: number
  paused: boolean
  ended: boolean
  blocked?: boolean
  holdMs?: number
}) {
  if (input.blocked || input.ended || input.paused || !input.playing) return true
  return coverShouldHold(input.playingForMs, input.holdMs)
}

/** The small app pause mark. Never on an ended clip — that is an advance or a calm end card. */
export function pauseMarkVisible(input: { paused: boolean; ended: boolean; userPaused: boolean }) {
  return input.userPaused && input.paused && !input.ended
}
