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

/** UNSTARTED, PAUSED, CUED. ENDED is not stuck — the feed moves on. */
const STUCK = new Set([-1, 2, 5])

export function shouldNudgePlay(state: number, armed: boolean, userPaused: boolean, tries: number, limit = 5) {
  return armed && !userPaused && tries < limit && STUCK.has(state)
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

/** Next / Prev hit boxes inside a phone. Kept in step with .j-step in journey.css. */
export const STEP_CONTROL = { top: 248, width: 72, height: 48, inset: 12 } as const

export function stepControlBox(which: 'next' | 'prev', viewport = { width: 390, height: 844 }) {
  const { top, width, height, inset } = STEP_CONTROL
  const left = which === 'prev' ? inset : viewport.width - inset - width
  return { left, top, width, height, right: left + width, bottom: top + height }
}

export function stepControlInside(which: 'next' | 'prev', viewport = { width: 390, height: 844 }) {
  const box = stepControlBox(which, viewport)
  return box.left >= 0 && box.top >= 0 && box.right <= viewport.width && box.bottom <= viewport.height && box.width >= 44 && box.height >= 44
}
