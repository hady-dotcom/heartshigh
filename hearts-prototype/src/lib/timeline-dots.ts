export type DotIn = { id: number; second: number }
export type DotPlace = { id: number; left: number; lift: number }

/**
 * Timeline marks sit on the line. Crowded marks are spread along the track, never lifted
 * off it, and never pushed past the end.
 */
export function placeDots(dots: DotIn[], total: number, width: number, hit = 44): DotPlace[] {
  const span = Math.max(1, width)
  const length = Math.max(1, total)
  const edge = 8
  const minX = edge
  const maxX = Math.max(minX, span - edge)
  const ordered = [...dots].sort((a, b) => a.second - b.second || a.id - b.id)
  const xs = ordered.map((dot) => Math.min(maxX, Math.max(minX, (dot.second / length) * span)))
  for (let index = 1; index < xs.length; index += 1) {
    if (xs[index] - xs[index - 1] < hit) xs[index] = xs[index - 1] + hit
  }
  if (xs.length && xs[xs.length - 1] > maxX) {
    const start = xs[0]
    const end = xs[xs.length - 1]
    const room = maxX - minX
    const spread = Math.max(1, end - start)
    for (let index = 0; index < xs.length; index += 1) {
      xs[index] = minX + ((xs[index] - start) / spread) * room
    }
  }
  return ordered.map((dot, index) => ({
    id: dot.id,
    left: Math.min(100, Math.max(0, (xs[index] / span) * 100)),
    lift: 0,
  }))
}
