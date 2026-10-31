/**
 * Swarm order: a random mix by default. No 'most read' or 'most popular'.
 * 'Answers like mine' and 'Surprise me' use keyword overlap (mock) or embeddings when a helper is passed.
 */

export type SwarmRow = { body: string; [key: string]: unknown }

const STOP = new Set(
  'a an the and or but if in on to of for with at by from as is was are were be been i you we they he she it my your our their this that these those not no yes so then than very just about into over after before'.split(' '),
)

export function keywords(text: string) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9'\s-]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP.has(word)),
  )
}

export function overlapScore(a: string, b: string) {
  const left = keywords(a)
  const right = keywords(b)
  if (!left.size || !right.size) return 0
  let hit = 0
  for (const word of left) if (right.has(word)) hit += 1
  return hit / Math.sqrt(left.size * right.size)
}

export type SwarmMode = 'mix' | 'like' | 'surprise'

function shuffle<T>(rows: T[], seed: string) {
  const out = [...rows]
  let n = 0
  for (const ch of seed) n = (n * 33 + ch.charCodeAt(0)) >>> 0
  for (let i = out.length - 1; i > 0; i -= 1) {
    n = (n * 1664525 + 1013904223) >>> 0
    const j = n % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function initialsOf(name: string | null | undefined) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return 'A'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function orderSwarm<T extends SwarmRow>(
  rows: T[],
  mine: string | null | undefined,
  mode: SwarmMode,
  seed = 'mix',
  score: (a: string, b: string) => number = overlapScore,
) {
  if (mode === 'mix' || !mine?.trim()) return shuffle(rows, seed)
  const scored = rows.map((row) => ({ row, score: score(mine, row.body) }))
  scored.sort((a, b) => (mode === 'like' ? b.score - a.score : a.score - b.score) || a.row.body.localeCompare(b.row.body))
  return scored.map((item) => item.row)
}
