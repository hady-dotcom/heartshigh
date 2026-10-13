/** A hors or appetiser window. Live clips can omit the appetiser entirely. */
export type ClipPiece = {
  start?: number
  end?: number
  lines?: { at?: number; text?: string }[]
  spans?: { start?: number; end?: number }[] | null
} | null

/** Spans on the appetiser. Missing appetiser is an empty list, never a throw. */
export function appetiserSpans(item: { appetiser?: ClipPiece } | null | undefined) {
  const spans = item?.appetiser?.spans
  if (!Array.isArray(spans)) return []
  return spans.filter((span): span is { start: number; end: number } => Number.isFinite(Number(span?.start)) && Number.isFinite(Number(span?.end)))
}

export function piecePoint(piece: ClipPiece | undefined, edge: 'start' | 'end') {
  const value = Number(piece?.[edge])
  return Number.isFinite(value) ? value : 0
}
