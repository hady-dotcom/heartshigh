export type DotIn = { id: number; second: number }
export type DotPlace = { id: number; left: number; lift: number }

/**
 * Timeline marks that sit about 10px apart share one tap. Spread a cluster so each
 * mark keeps a full tap target, and lift the extras so the marks themselves stay apart.
 */
export function placeDots(dots: DotIn[], total: number, width: number, hit = 44): DotPlace[] {
  const span = Math.max(1, width)
  const length = Math.max(1, total)
  const edge = 8
  const ordered = [...dots].sort((a, b) => a.second - b.second || a.id - b.id)
  const xs = ordered.map((dot) => Math.min(span - edge, Math.max(edge, (dot.second / length) * span)))
  const raw = [...xs]
  for (let index = 1; index < xs.length; index += 1) {
    if (xs[index] - xs[index - 1] < hit) xs[index] = xs[index - 1] + hit
  }
  const overflow = xs.length ? xs[xs.length - 1] - (span - edge) : 0
  if (overflow > 0) {
    for (let index = 0; index < xs.length; index += 1) xs[index] = Math.max(edge, xs[index] - overflow)
  }
  return ordered.map((dot, index) => {
    const crowded = ordered.some((_, other) => other !== index && Math.abs(raw[index] - raw[other]) < hit)
    const lift = crowded ? (index % 2 === 0 ? -10 : 10) : 0
    return { id: dot.id, left: (xs[index] / span) * 100, lift }
  })
}
