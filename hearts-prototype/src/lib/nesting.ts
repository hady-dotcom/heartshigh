// The ladder of one talk: the full talk contains the appetiser, which contains the hors d'oeuvre.
// Each piece stores a parent reference. Learn more walks exactly one step, and never skips.

export type PieceLevel = 'hors' | 'appetiser' | 'talk'

export type PieceRef = {
  id: string
  level: PieceLevel
  /** Hors d'oeuvre -> its appetiser. Appetiser -> its full talk. A full talk has no parent. */
  parentId: string | null
  parentLevel: 'appetiser' | 'talk' | null
}

export type TalkChain = Record<PieceLevel, PieceRef>

/** Stable ids for the three pieces of one lesson. The hors d'oeuvre's parent is the appetiser, never the talk. */
export function talkChain(lessonId: number): TalkChain {
  const talk = `talk:${lessonId}`
  const appetiser = `appetiser:${lessonId}`
  const hors = `hors:${lessonId}`
  return {
    talk: { id: talk, level: 'talk', parentId: null, parentLevel: null },
    appetiser: { id: appetiser, level: 'appetiser', parentId: talk, parentLevel: 'talk' },
    hors: { id: hors, level: 'hors', parentId: appetiser, parentLevel: 'appetiser' },
  }
}

/** One step down. A hors d'oeuvre resolves to its appetiser, and that appetiser resolves to the full talk. */
export function descend(level: PieceLevel, lessonId: number): PieceRef | null {
  const chain = talkChain(lessonId)
  const piece = chain[level]
  if (!piece.parentId || !piece.parentLevel) return null
  return chain[piece.parentLevel]
}

export type LadderPiece = {
  id?: number
  kind?: string | null
  start?: number | null
  end?: number | null
}

/**
 * The parent reference written on a ladder row.
 * An appetiser points at the full talk. A hors d'oeuvre points at the appetiser that contains its window.
 */
export function ladderParentRef(piece: LadderPiece, appetisers: LadderPiece[], lessonId: number): string {
  if (piece.kind === 'appetiser') return `talk:${lessonId}`
  const start = Number(piece.start || 0)
  const end = Number(piece.end || 0)
  const containing = appetisers.find((row) => row.id && start >= Number(row.start || 0) - 1 && end <= Number(row.end || 0) + 1)
  const pick = containing || appetisers.find((row) => row.id)
  if (pick?.id) return `appetiser:${pick.id}`
  return talkChain(lessonId).hors.parentId as string
}

/** A learn-more step is valid only when it names this piece's own parent level. */
export function parentIsOwn(level: 'hors' | 'appetiser', parent: string): boolean {
  if (level === 'hors') return parent.startsWith('appetiser:')
  return parent.startsWith('talk:')
}
