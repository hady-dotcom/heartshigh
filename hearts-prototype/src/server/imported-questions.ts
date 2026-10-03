import type { Payload } from 'payload'
import { isImportedSheetDraft, type QuestionStamp } from '@/lib/imported-questions'

/** Every draft question the sheet import left for a person, and nobody has claimed since. */
export async function importedSheetDraftIds(payload: Payload): Promise<number[]> {
  const ids: number[] = []
  let page = 1
  for (;;) {
    const found = await payload.find({
      collection: 'engagement-points',
      overrideAccess: true,
      depth: 0,
      limit: 100,
      page,
      where: { status: { equals: 'draft' } },
    })
    for (const doc of found.docs as unknown as (QuestionStamp & { id: number })[]) {
      if (isImportedSheetDraft(doc)) ids.push(doc.id)
    }
    if (!found.hasNextPage || page >= 200) break
    page += 1
  }
  return ids
}
