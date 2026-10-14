import type { Payload } from 'payload'
import { foldPlacingPrompt, PLACING_DEFAULT, PLACING_EXTRA, placingBankByKey, type PlacingBankRow } from '../lib/placing-bank'

type Doc = { id: number; prompt?: string; portal?: unknown }

async function existingPrompts(payload: Payload, portalId?: number) {
  const where = portalId
    ? { or: [{ portal: { exists: false } }, { portal: { equals: portalId } }] }
    : { portal: { exists: false } }
  const found = await payload.find({
    collection: 'placing-questions',
    overrideAccess: true,
    depth: 0,
    limit: 100,
    pagination: false,
    where: where as never,
  })
  return new Set((found.docs as Doc[]).map((row) => foldPlacingPrompt(String(row.prompt || ''))))
}

async function addMissing(payload: Payload, rows: PlacingBankRow[], portalId: number | undefined, startOrder: number) {
  const have = await existingPrompts(payload, portalId)
  let order = startOrder
  let added = 0
  for (const row of rows) {
    if (have.has(foldPlacingPrompt(row.prompt))) continue
    await payload.create({
      collection: 'placing-questions',
      overrideAccess: true,
      data: { prompt: row.prompt, why: row.why, options: row.options, order, portal: portalId },
    })
    have.add(foldPlacingPrompt(row.prompt))
    order += 1
    added += 1
  }
  return added
}

/** Writes the four global joining questions if they are missing. Never deletes. */
export async function ensureDefaultPlacing(payload: Payload) {
  const count = await payload.count({ collection: 'placing-questions', overrideAccess: true, where: { portal: { exists: false } } as never })
  return addMissing(payload, PLACING_DEFAULT, undefined, count.totalDocs + 1)
}

/** Attaches the extra joining bank to one portal. Skips prompts that portal already shows. */
export async function attachExtraPlacing(payload: Payload, portalId: number, keys?: string[]) {
  const rows = keys?.length
    ? keys.map((key) => placingBankByKey(key)).filter((row): row is PlacingBankRow => Boolean(row && PLACING_EXTRA.some((extra) => extra.key === row.key)))
    : PLACING_EXTRA
  const count = await payload.count({ collection: 'placing-questions', overrideAccess: true, where: { portal: { equals: portalId } } as never })
  return addMissing(payload, rows, portalId, 20 + count.totalDocs)
}
