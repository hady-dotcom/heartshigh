import type { Payload } from 'payload'
import { draftsForGap, lessonIdOf, type CircleFillPoint } from '../lib/circle-apply'

/** Adds circle answers where a question has fewer than four. Never deletes or rewrites a row that is already there. */
export async function fillMissingCircleAnswers(payload: Payload) {
  const points = await payload.find({
    collection: 'engagement-points',
    overrideAccess: true,
    depth: 0,
    limit: 0,
    pagination: false,
    where: { family: { not_equals: 'workbook' } },
  })
  let added = 0
  let skipped = 0
  let blocked = 0
  for (const raw of points.docs as unknown as CircleFillPoint[]) {
    const existing = await payload.count({
      collection: 'circle-answers' as never,
      overrideAccess: true,
      where: { point: { equals: raw.id } } as never,
    })
    const writing = draftsForGap(raw, existing.totalDocs)
    if (!writing.length) {
      if (existing.totalDocs >= 4) skipped += 1
      else blocked += 1
      continue
    }
    const lesson = lessonIdOf(raw)
    for (const draft of writing) {
      await payload.create({
        collection: 'circle-answers',
        overrideAccess: true,
        data: {
          point: raw.id,
          lesson: lesson || undefined,
          name: draft.name,
          body: draft.body,
          tone: draft.tone,
          length: draft.length,
          origin: 'staff',
          enabled: true,
        },
      })
      added += 1
    }
  }
  return { added, skipped, blocked, questions: points.docs.length }
}
