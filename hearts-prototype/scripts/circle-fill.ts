/**
 * Adds HEARTS circle answers where a question has fewer than four.
 * Additive: it never deletes or rewrites an answer that is already there.
 * Refuses a production or remote database. `--dry-run` prints the plan and writes nothing.
 *
 *   npm run circle:fill -- --dry-run
 *   npm run circle:fill
 */
import { closePayload, clearDevPushMarker } from '../src/lib/prepare-db'
import { isProduction, isRemoteDatabase } from '../src/lib/env'
import { answersForPoint, circleFillProblems, FILL_MIN } from '../src/lib/circle-fill'

const dryRun = process.argv.includes('--dry-run')

if (!dryRun && (isProduction() || isRemoteDatabase())) {
  console.error('Refusing to write circle answers on a production or remote database. Nothing was changed.')
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
  for (const point of points.docs as unknown as { id: number; prompt?: string; kind?: string; options?: string[]; lesson?: unknown }[]) {
    const existing = await payload.count({
      collection: 'circle-answers' as never,
      overrideAccess: true,
      where: { point: { equals: point.id } } as never,
    })
    if (existing.totalDocs >= FILL_MIN) {
      skipped += 1
      continue
    }
    const lessonId = typeof point.lesson === 'number' ? point.lesson : (point.lesson as { id?: number } | null)?.id
    const drafts = answersForPoint({ prompt: String(point.prompt || ''), kind: String(point.kind || 'reflection'), options: point.options })
    const problems = circleFillProblems(drafts)
    if (problems.length) {
      console.error(`Skipped question ${point.id}: ${problems.join(' ')}`)
      continue
    }
    const room = existing.totalDocs === 0 ? drafts.length : FILL_MIN - existing.totalDocs
    const writing = drafts.slice(0, room)
    console.log(`${dryRun ? 'Would add' : 'Adding'} ${writing.length} on question ${point.id} (${existing.totalDocs} already): ${String(point.prompt || '').slice(0, 72)}`)
    if (!dryRun) {
      for (const draft of writing) {
        await payload.create({
          collection: 'circle-answers',
          overrideAccess: true,
          data: {
            point: point.id,
            lesson: lessonId || undefined,
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
  console.log(`${dryRun ? 'Dry run. ' : ''}${added} circle answers ${dryRun ? 'would be added' : 'added'}. ${skipped} questions already have at least ${FILL_MIN}.`)
} finally {
  await closePayload(payload)
}
process.exit(0)
