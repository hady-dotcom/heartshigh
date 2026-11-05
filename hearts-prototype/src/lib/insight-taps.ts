/** Angry-tap and heatmap helpers. Never look at typed text. */

export type TapPoint = { x: number; y: number; at: number }

export const ANGRY_WINDOW_MS = 1500
export const ANGRY_MIN = 3
export const ANGRY_RADIUS = 28

export function sameSpot(a: Pick<TapPoint, 'x' | 'y'>, b: Pick<TapPoint, 'x' | 'y'>, radius = ANGRY_RADIUS) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy <= radius * radius
}

export type AngryBurst = { x: number; y: number; count: number; at: number; taps: TapPoint[] }

/**
 * A burst is three or more taps in the same spot within 1.5 seconds.
 * Later taps in the same burst are not reported again.
 */
export function detectAngryTaps(taps: TapPoint[], options?: { windowMs?: number; min?: number; radius?: number }): AngryBurst[] {
  const windowMs = options?.windowMs ?? ANGRY_WINDOW_MS
  const min = options?.min ?? ANGRY_MIN
  const radius = options?.radius ?? ANGRY_RADIUS
  const ordered = [...taps].sort((a, b) => a.at - b.at)
  const bursts: AngryBurst[] = []
  const used = new Set<number>()
  for (let i = 0; i < ordered.length; i++) {
    if (used.has(i)) continue
    const cluster: TapPoint[] = [ordered[i]]
    const indexes = [i]
    for (let j = i + 1; j < ordered.length; j++) {
      if (used.has(j)) continue
      if (ordered[j].at - ordered[i].at > windowMs) break
      if (sameSpot(ordered[i], ordered[j], radius)) {
        cluster.push(ordered[j])
        indexes.push(j)
      }
    }
    if (cluster.length >= min) {
      const last = cluster[cluster.length - 1]
      bursts.push({
        x: Math.round(cluster.reduce((sum, tap) => sum + tap.x, 0) / cluster.length),
        y: Math.round(cluster.reduce((sum, tap) => sum + tap.y, 0) / cluster.length),
        count: cluster.length,
        at: last.at,
        taps: cluster,
      })
      for (const index of indexes) used.add(index)
    }
  }
  return bursts
}

/** Did this new tap complete an angry burst with the recent ones? */
export function angryFromLatest(history: TapPoint[], incoming: TapPoint, options?: { windowMs?: number; min?: number; radius?: number }): AngryBurst | null {
  const windowMs = options?.windowMs ?? ANGRY_WINDOW_MS
  const min = options?.min ?? ANGRY_MIN
  const radius = options?.radius ?? ANGRY_RADIUS
  const recent = history.filter((tap) => incoming.at - tap.at <= windowMs && incoming.at >= tap.at && sameSpot(tap, incoming, radius))
  const cluster = [...recent, incoming]
  if (cluster.length < min) return null
  if (recent.length + 1 !== cluster.length) return null
  // Only fire when we cross the threshold, not on every extra tap.
  if (cluster.length !== min && recent.length >= min) return null
  if (cluster.length !== min) return null
  return {
    x: Math.round(cluster.reduce((sum, tap) => sum + tap.x, 0) / cluster.length),
    y: Math.round(cluster.reduce((sum, tap) => sum + tap.y, 0) / cluster.length),
    count: cluster.length,
    at: incoming.at,
    taps: cluster,
  }
}

export type HeatCell = { x: number; y: number; n: number }

/** Bin taps into a grid for a heatmap overlay. Coordinates are 0–1 of the viewport. */
export function heatmapGrid(taps: { x: number; y: number; vw?: number; vh?: number }[], cols = 16, rows = 28): HeatCell[] {
  const cells = new Map<string, HeatCell>()
  for (const tap of taps) {
    const nx = tap.vw && tap.vw > 0 ? tap.x / tap.vw : tap.x
    const ny = tap.vh && tap.vh > 0 ? tap.y / tap.vh : tap.y
    const cx = Math.max(0, Math.min(cols - 1, Math.floor(nx * cols)))
    const cy = Math.max(0, Math.min(rows - 1, Math.floor(ny * rows)))
    const key = `${cx}:${cy}`
    const held = cells.get(key)
    if (held) held.n += 1
    else cells.set(key, { x: cx, y: cy, n: 1 })
  }
  return [...cells.values()]
}
