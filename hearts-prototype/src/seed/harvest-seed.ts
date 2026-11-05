import type { Payload } from 'payload'
import { now } from '@/lib/clock'
import { portalIdOf } from '@/lib/ids'
import { clearHarvestSample, sampleHarvest } from '@/server/harvest'

/** Spoken lines in Maryam's harvest, taken from real transcript lines, beside the verses and hadith of the talks she finished. */
export async function seedDemoHarvest(payload: Payload) {
  clearHarvestSample()
  const found = await payload.find({
    collection: 'users',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { email: { equals: 'elm-learner@hearts.test' } },
  })
  const maryam = found.docs[0]
  if (!maryam) return
  const existing = await payload.find({
    collection: 'harvest-entries',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { and: [{ user: { equals: maryam.id } }, { kind: { equals: 'line' } }] },
  })
  if (existing.totalDocs) return
  const moments = await sampleHarvest(payload, now())
  if (!moments.length) {
    console.log('Harvest sample: no transcript lines to keep.')
    return
  }
  const portal = portalIdOf(maryam as { tenants?: { tenant?: unknown }[] })
  for (const moment of moments) {
    await payload.create({
      collection: 'harvest-entries',
      overrideAccess: true,
      data: {
        user: maryam.id,
        lesson: moment.lessonId,
        portal: portal || undefined,
        kind: moment.kind,
        text: moment.text,
        reference: '',
        timestamp: moment.timestamp,
        context: '',
        seconds: moment.seconds,
        speaker: moment.speaker,
        door: moment.door || undefined,
        surface: moment.surface,
        gatheredAt: moment.gatheredAt,
      } as never,
    })
  }
  clearHarvestSample()
  console.log(`Harvest sample: ${moments.length} lines kept for Maryam.`)
}
