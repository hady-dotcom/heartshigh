/** Fresh taps inside the More sheet are ignored until the drawer has settled. */
export const BOARD_ARM_MS = 300
/** Pointer travel that counts as a drag, not a tap. */
export const BOARD_DRAG_PX = 8
/** Downward travel that closes the More sheet. */
export const BOARD_CLOSE_DY = 20
/** A short downward flick still closes, if it is fast enough. */
export const BOARD_FLICK_DY = 8
export const BOARD_FLICK_V = 0.35
/** After More, the scrim, or the handle closes, ignore leftover picture taps. */
export const PICTURE_SWALLOW_MS = 480

export function boardShouldClose(dy: number, velocity = 0, threshold = BOARD_CLOSE_DY) {
  return dy > threshold || (dy > BOARD_FLICK_DY && velocity >= BOARD_FLICK_V)
}

export function boardShouldOpen(dy: number, velocity = 0, threshold = BOARD_CLOSE_DY) {
  return dy < -threshold || (dy < -BOARD_FLICK_DY && velocity <= -BOARD_FLICK_V)
}

/** A tap on the handle, board, or scrim must never toggle the film. */
export function pictureTapIgnored(input: { boardOpen: boolean; swallowUntil: number; now: number }) {
  return input.boardOpen || input.now < input.swallowUntil
}

/**
 * Save (or any board control) at the same moment as an auto-advance: the tap
 * may miss both clips, which is fine. The new clip still resets its cover hold,
 * and a later picture tap pauses; it never skips.
 */
export function saveDuringAdvanceThenTap(input: {
  holdReset: boolean
  playStartedFromNewPlaying: boolean
  tapTravelX: number
  tapTravelY: number
  swipePx?: number
}) {
  const swipePx = input.swipePx ?? 40
  const skip = Math.abs(input.tapTravelY) > Math.abs(input.tapTravelX) && Math.abs(input.tapTravelY) >= swipePx
  const holdReady = input.holdReset && input.playStartedFromNewPlaying
  return {
    registeredOrIgnored: true,
    coverHeld: holdReady,
    pause: !skip && holdReady,
    skip,
  }
}

/**
 * Advance, open More, close on the scrim: leftover pointer work is swallowed
 * and auto-advance must have cleared userPaused, so the film stays PLAYING.
 */
export function moreAfterAdvanceThenScrim(input: {
  userPausedAfterAdvance: boolean
  boardOpen: boolean
  leftoverTapAt: number
  swallowUntil: number
  playerState: number
}) {
  const pictureIgnored = pictureTapIgnored({
    boardOpen: input.boardOpen,
    swallowUntil: input.swallowUntil,
    now: input.leftoverTapAt,
  })
  const playing = input.playerState === 1 && !input.userPausedAfterAdvance
  return { playing, pictureIgnored, userPaused: input.userPausedAfterAdvance }
}

export function boardSettled(openedAt: number, now: number, armMs = BOARD_ARM_MS) {
  return openedAt > 0 && now - openedAt >= armMs
}

export function isDragEnd(travel: number, threshold = BOARD_DRAG_PX) {
  return travel >= threshold
}

/** A control inside the More sheet only fires on a fresh tap after the sheet has settled. */
export function boardClickAllowed(input: { openedAt: number; now: number; travel: number; armMs?: number; dragPx?: number }) {
  if (isDragEnd(input.travel, input.dragPx)) return false
  return boardSettled(input.openedAt, input.now, input.armMs)
}

export function pointerTravel(from: { x: number; y: number }, to: { x: number; y: number }) {
  return Math.hypot(to.x - from.x, to.y - from.y)
}
