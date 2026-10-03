import type { Payload, PayloadRequest } from 'payload'
import { idOf } from '@/lib/ids'
import { ladderParentRef, type LadderPiece } from '@/lib/nesting'

type LadderDoc = { id: number; lesson?: unknown; kind?: string | null; start?: number | null; end?: number | null; parentRef?: string | null }

async function appetisersOf(payload: Payload, lessonId: number): Promise<LadderPiece[]> {
  const found = await payload.find({
    collection: 'ladder-items',
    overrideAccess: true,
    depth: 0,
    limit: 40,
    where: { and: [{ lesson: { equals: lessonId } }, { kind: { equals: 'appetiser' } }] },
  })
  return found.docs.map((row) => ({
    id: row.id,
    kind: 'appetiser',
    start: Number((row as { start?: number }).start || 0),
    end: Number((row as { end?: number }).end || 0),
  }))
}

async function writeParent(payload: Payload, req: PayloadRequest, id: number, parentRef: string) {
  await payload.update({
    collection: 'ladder-items',
    id,
    overrideAccess: true,
    req,
    context: { pieceParent: true },
    data: { parentRef },
  })
}

/** After a ladder row is saved, point it at its own parent, and point sibling hors d'oeuvres at an appetiser just saved. */
export async function linkLadderParents(req: PayloadRequest, doc: LadderDoc) {
  if (req.context?.pieceParent) return
  const lessonId = idOf(doc.lesson)
  if (!lessonId) return
  const payload = req.payload
  const kind = String(doc.kind || '')
  if (kind === 'appetiser') {
    const want = ladderParentRef({ kind: 'appetiser' }, [], lessonId)
    if (doc.parentRef !== want) await writeParent(payload, req, doc.id, want)
    const appetisers = await appetisersOf(payload, lessonId)
    const hors = await payload.find({
      collection: 'ladder-items',
      overrideAccess: true,
      depth: 0,
      limit: 80,
      where: { and: [{ lesson: { equals: lessonId } }, { kind: { equals: 'hors' } }] },
    })
    for (const row of hors.docs) {
      const current = row as { id: number; parentRef?: string | null; start?: number | null; end?: number | null }
      const next = ladderParentRef({ kind: 'hors', start: current.start, end: current.end }, appetisers, lessonId)
      if (current.parentRef !== next) await writeParent(payload, req, current.id, next)
    }
    return
  }
  if (kind === 'hors') {
    const appetisers = await appetisersOf(payload, lessonId)
    const want = ladderParentRef({ kind: 'hors', start: doc.start, end: doc.end }, appetisers, lessonId)
    if (doc.parentRef !== want) await writeParent(payload, req, doc.id, want)
  }
}
