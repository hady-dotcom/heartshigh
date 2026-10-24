/**
 * Adds HEARTS circle answers where a question has fewer than four.
 * Additive: it never deletes or rewrites an answer that is already there.
 * Refuses a production or remote database unless HEARTS_DEMO=1. `--dry-run` prints the plan and writes nothing.
 *
 *   npm run circle:fill -- --dry-run
 *   npm run circle:fill
 */
import { closePayload, clearDevPushMarker } from '../src/lib/prepare-db'
import { circleDemoGuard, draftsForGap, lessonIdOf, type CircleFillPoint } from '../src/lib/circle-apply'

const dryRun = process.argv.includes('--dry-run')
const guard = circleDemoGuard()

if (!dryRun && guard) {
  console.error(guard)
  process.exit(1)
}

await clearDevPushMarker()
const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })

let added = 0
let skipped = 0
try {
  const points = await payload.find({
    collection: 'engagement-points',
    overrideAccess: true,
    depth: 0,
    limit: 0,
    pagination: false,
    where: { family: { not_equals: 'workbook' } },
  })
  for (const point of points.docs as unknown as CircleFillPoint[]) {
    const existing = await payload.count({
      collection: 'circle-answers' as never,
      overrideAccess: true,
      where: { point: { equals: point.id } } as never,
    })
    const writing = draftsForGap(point, existing.totalDocs)
    if (!writing.length) {
      skipped += 1
      continue
    }
    console.log(`${dryRun ? 'Would add' : 'Adding'} ${writing.length} on question ${point.id} (${existing.totalDocs} already): ${String(point.prompt || '').slice(0, 72)}`)
    if (!dryRun) {
      const lesson = lessonIdOf(point)
      for (const draft of writing) {
        await payload.create({
          collection: 'circle-answers',
          overrideAccess: true,
          data: {
            point: point.id,
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
    } else added += writing.length
  }
  console.log(`${dryRun ? 'Dry run. ' : ''}${added} circle answers ${dryRun ? 'would be added' : 'added'}. ${skipped} questions already have enough, or were skipped.`)
} finally {
  await closePayload(payload)
}
process.exit(0)
