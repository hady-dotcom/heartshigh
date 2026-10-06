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
export const PICTURE_SWALLOW_MS = 400

/** Auto-advance keeps More open so Save still hits the board. A swipe may close it. */
export function autoAdvanceClosesBoard(how: 'swipe' | 'auto') {
  return how === 'swipe'
}

/**
 * The lane end treats an open More board the way an auto-advance mid-lane does: it stays open and
 * usable, so a Like or Save in progress lands (on the clip shown at the press). Only a swipe past the
 * last clip, which can only start with the board shut, is a "swipe" here.
 */
export function laneEndClosesBoard(how: 'swipe' | 'auto') {
  return autoAdvanceClosesBoard(how)
}

/** The lane-end card waits until the board and the sign-up sheet are both shut, then shows. */
export function endCardShows(input: { clipEnded: boolean; lastClip: boolean; boardOpen: boolean; sheetOpen: boolean }) {
  return input.clipEnded && input.lastClip && !input.boardOpen && !input.sheetOpen
}

/** Closing More on the end card must not move the playlist. */
export function endCardAfterBoardClose(input: { index: number; clipEnded: boolean }) {
  return { index: input.index, clipEnded: input.clipEnded }
}

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

/** Finger travel inside one control that still counts as a tap on it. */
export const BOARD_TAP_SLOP_PX = 24

/**
 * Whether a More-board control fires. A press that began on this very control after the board
 * opened is a fresh tap and always fires (within the tap slop): no arm wait, and no travel read
 * from an older board drag. Anything else keeps the old guard (settled board, no drag end).
 */
export function boardTapFires(input: { pressedHere: boolean; pressedAt: number; pressTravel: number; openedAt: number; now: number; dragTravel: number }) {
  if (input.pressedHere && input.openedAt > 0 && input.pressedAt >= input.openedAt) return input.pressTravel < BOARD_TAP_SLOP_PX
  return boardClickAllowed({ openedAt: input.openedAt, now: input.now, travel: input.dragTravel })
}

/**
 * A swipe or picture tap on the feed counts only for a gesture that began on the feed while the
 * board was shut, after it last closed, with the same pointer. Closing the board (a drag down on
 * its handle, the scrim, the close button, Escape) can never carry on into a lane or clip change.
 */
export function feedGestureCounts(input: { startedAt: number; boardOpen: boolean; boardClosedAt: number; pointerId?: number | null; upPointerId?: number | null }) {
  if (input.boardOpen) return false
  if (input.startedAt <= input.boardClosedAt) return false
  if (input.pointerId != null && input.upPointerId != null && input.pointerId !== input.upPointerId) return false
  return true
}

/** Only the help card's own tap dismisses it; that tap never reaches the film. */
export function coachTapAction(input: { onCard: boolean }): 'dismiss-only' | 'film' {
  return input.onCard ? 'dismiss-only' : 'film'
}

/**
 * When a board Like or Save lands on the clip the board showed at the press, but an auto-advance
 * has since moved the board on, say so: the tap worked, on the clip the guest meant.
 */
export function boardTapNote(input: { action: 'like' | 'save'; wasOn: boolean; title: string; landedOnShown: boolean }): string | null {
  if (input.landedOnShown) return null
  const name = input.title.trim() || 'that clip'
  if (input.action === 'like') return input.wasOn ? `Like removed from ${name}` : `Liked ${name}`
  return input.wasOn ? `Removed ${name} from Saved` : `Saved ${name}`
}

/** How long after the board opens or closes a click with no fresh press is treated as a leftover. */
export const GHOST_CLICK_MS = 700

/**
 * The click a phone sends after the tap that opened (or closed) the More board belongs to that tap.
 * The board opens on the lift, so the browser aims that click at whatever is now under the finger,
 * with touch adjustment picking the nearest link: the board's own buttons, or the tab bar right
 * under the More handle, which asks a guest to make an account. A click counts only if a press
 * started after the board changed; a keyboard click (detail 0) always counts.
 */
export function ghostClick(input: { now: number; boardChangedAt: number; lastPressAt: number; detail: number }) {
  if (input.detail === 0) return false
  if (input.boardChangedAt <= 0 || input.now - input.boardChangedAt > GHOST_CLICK_MS) return false
  // A press since the change is a fresh tap. Only the press that made the change (it began just before) owns the click.
  if (input.lastPressAt <= 0 || input.lastPressAt > input.boardChangedAt) return false
  return input.boardChangedAt - input.lastPressAt <= GHOST_PRESS_MS
}

/** The press that opens or closes the board begins at most this long before the change (a slow drag included). */
export const GHOST_PRESS_MS = 2000

/**
 * The click fallback for a More-board control. The control acts on pointerup; when that did not act for
 * this press (a pointerup that never came or was cancelled, or a guard that misread it) the browser's
 * own click still does, once: the click only exists for a real tap that pressed and lifted on this
 * control. It never doubles a tap that already acted, and never fires for a press from before the
 * board opened. A keyboard click (detail 0) always acts.
 */
export function boardClickFires(input: { detail: number; boardOpen: boolean; pressedHere: boolean; acted: boolean; pressedAt: number; openedAt: number }) {
  if (!input.boardOpen) return false
  if (input.detail === 0) return true
  if (!input.pressedHere || input.acted) return false
  return input.openedAt > 0 && input.pressedAt >= input.openedAt
}

/**
 * What a lift on the More handle, the board's grab row or the board itself does. Shut: a tap (any
 * wobble inside the tap slop, in any direction) or an upward swipe opens; nothing else does, so a
 * small downward wobble can no longer "close" a board that is already shut and eat the tap. Open: a
 * downward swipe or flick closes, a tap closes, an upward swipe keeps it open.
 */
export function boardHandleAction(input: { boardOpen: boolean; dy: number; velocity: number; travel: number }): 'open' | 'close' | 'none' {
  if (!input.boardOpen) {
    if (boardShouldOpen(input.dy, input.velocity)) return 'open'
    return input.travel < BOARD_TAP_SLOP_PX ? 'open' : 'none'
  }
  if (boardShouldClose(input.dy, input.velocity)) return 'close'
  if (boardShouldOpen(input.dy, input.velocity)) return 'none'
  return input.travel < BOARD_HANDLE_TAP_PX ? 'close' : 'none'
}

/** Travel under which a lift on the open board's handle or background is a tap that closes it. */
export const BOARD_HANDLE_TAP_PX = 14
