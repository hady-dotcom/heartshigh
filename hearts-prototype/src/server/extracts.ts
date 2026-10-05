import type { Payload } from 'payload'
import {
  attachHorsToAppetisers,
  extractsFromTier,
  orderExtracts,
  parseExtractStatus,
  sameExtractWindow,
  type TalkExtract,
} from '@/lib/extracts'
import { idOf } from '@/lib/ids'

type Doc = Record<string, unknown> & { id: number }

function lessonIdOf(doc: Record<string, unknown>) {
  const related = doc.lesson
  return (
    idOf(related) ||
    idOf(doc.lesson_id) ||
    (related && typeof related === 'object' && 'value' in related ? idOf((related as { value?: unknown }).value) : null) ||
    0
  )
}

function asExtract(doc: Doc): TalkExtract {
  return {
    id: doc.id,
    lesson: lessonIdOf(doc),
    kind: (doc.kind === 'appetiser' ? 'appetiser' : 'hors') as TalkExtract['kind'],
    start: Number(doc.start),
    end: Number(doc.end),
    quote: String(doc.quote || ''),
    words: Array.isArray(doc.words) ? (doc.words as TalkExtract['words']) : null,
    score: doc.score == null || doc.score === '' ? null : Number(doc.score),
    status: parseExtractStatus(doc.status),
    door: doc.door == null || doc.door === '' ? null : Number(doc.door),
    seat: idOf(doc.seat),
    order: Number(doc.order || 1),
    parent: idOf(doc.parent),
    arc: doc.arc === 'hook' || doc.arc === 'turn' || doc.arc === 'land' ? doc.arc : null,
    hook: String(doc.hook || ''),
    turn: String(doc.turn || ''),
    land: String(doc.land || ''),
    source: String(doc.source || ''),
  }
}

export async function extractsForLesson(payload: Payload, lessonId: number): Promise<TalkExtract[]> {
  const found = await payload.find({
    collection: 'talk-extracts',
    overrideAccess: true,
    depth: 0,
    limit: 500,
    pagination: false,
    where: { lesson: { equals: lessonId } },
  })
  return found.docs.map((doc) => asExtract(doc as unknown as Doc))
}

export async function extractsForLessons(payload: Payload, lessonIds: number[]): Promise<TalkExtract[]> {
  if (!lessonIds.length) return []
  const found = await payload.find({
    collection: 'talk-extracts',
    overrideAccess: true,
    depth: 0,
    limit: 2000,
    pagination: false,
    where: { lesson: { in: lessonIds } },
  })
  return found.docs.map((doc) => asExtract(doc as unknown as Doc))
}

function writeData(row: TalkExtract) {
  return {
    lesson: row.lesson,
    kind: row.kind,
    start: row.start,
    end: row.end,
    quote: row.quote || '',
    words: row.words || null,
    score: row.score ?? undefined,
    status: row.status,
    door: row.door ?? undefined,
    seat: row.seat || undefined,
    order: row.order,
    parent: row.parent || undefined,
    arc: row.arc || undefined,
    hook: row.hook || undefined,
    turn: row.turn || undefined,
    land: row.land || undefined,
    source: row.source || undefined,
  }
}

/** Point each hors at the appetiser that holds it, and mark hook, turn or land. */
export async function relinkExtractParents(payload: Payload, lessonId: number) {
  const rows = await extractsForLesson(payload, lessonId)
  const linked = attachHorsToAppetisers(rows)
  for (const row of linked) {
    if (row.kind !== 'hors' || row.id == null) continue
    const current = rows.find((item) => item.id === row.id)
    if (!current) continue
    if (current.parent === row.parent && current.arc === row.arc) continue
    await payload.update({
      collection: 'talk-extracts',
      id: row.id,
      overrideAccess: true,
      data: { parent: row.parent || null, arc: row.arc || null } as never,
    })
  }
  return linked
}

/**
 * Copy the talk-tier pair into extracts when this talk has none of the same windows yet.
 * Safe to run again: matching windows are left alone.
 */
export async function syncExtractsFromTier(
  payload: Payload,
  lessonId: number,
  tier: Parameters<typeof extractsFromTier>[0],
) {
  const existing = await extractsForLesson(payload, lessonId)
  const wanted = extractsFromTier(tier, lessonId)
  const created: TalkExtract[] = []
  for (const row of wanted) {
    const match = existing.find((item) => sameExtractWindow(item, row))
    if (match) {
      created.push(match)
      continue
    }
    const doc = (await payload.create({
      collection: 'talk-extracts',
      overrideAccess: true,
      data: writeData(row) as never,
    })) as unknown as Doc
    created.push(asExtract(doc))
  }
  const all = orderExtracts([...existing, ...created.filter((row) => !existing.some((item) => item.id === row.id))])
  for (const [index, row] of all.entries()) {
    if (row.id && row.order !== index + 1) {
      await payload.update({ collection: 'talk-extracts', id: row.id, overrideAccess: true, data: { order: index + 1 } as never })
    }
  }
  await relinkExtractParents(payload, lessonId)
  return extractsForLesson(payload, lessonId)
}

/** Walk every talk-tier and copy its pair into extracts. Used by seed and the migration helper. */
export async function migrateTiersToExtracts(payload: Payload) {
  const tiers = await payload.find({ collection: 'talk-tiers', overrideAccess: true, depth: 0, limit: 0, pagination: false })
  let created = 0
  for (const tier of tiers.docs) {
    const lessonId = idOf((tier as { lesson?: unknown }).lesson)
    if (!lessonId) continue
    const before = await extractsForLesson(payload, lessonId)
    const after = await syncExtractsFromTier(payload, lessonId, {
      lesson: lessonId,
      horsStart: Number((tier as { horsStart?: number }).horsStart),
      horsEnd: Number((tier as { horsEnd?: number }).horsEnd),
      horsQuote: String((tier as { horsQuote?: string }).horsQuote || ''),
      horsLines: (tier as { horsLines?: unknown }).horsLines,
      appetiserStart: Number((tier as { appetiserStart?: number }).appetiserStart),
      appetiserEnd: Number((tier as { appetiserEnd?: number }).appetiserEnd),
      hook: String((tier as { hook?: string }).hook || ''),
      turn: String((tier as { turn?: string }).turn || ''),
      land: String((tier as { land?: string }).land || ''),
      appetiserSpans: (tier as { appetiserSpans?: TalkExtract[] }).appetiserSpans as never,
      status: String((tier as { status?: string }).status || 'draft'),
    })
    created += Math.max(0, after.length - before.length)
  }
  return { talks: tiers.docs.length, created }
}
