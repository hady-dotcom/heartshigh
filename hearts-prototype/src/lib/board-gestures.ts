/** Fresh taps inside the More sheet are ignored until the drawer has settled. */
export const BOARD_ARM_MS = 300
/** Pointer travel that counts as a drag, not a tap. */
export const BOARD_DRAG_PX = 8
/** Downward travel that closes the More sheet. */
export const BOARD_CLOSE_DY = 20

export function boardShouldClose(dy: number, threshold = BOARD_CLOSE_DY) {
  return dy > threshold
}

export function boardShouldOpen(dy: number, threshold = BOARD_CLOSE_DY) {
  return dy < -threshold
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
