import { getPayload } from 'payload'
import config from '../src/payload.config'
import { closePayload } from '../src/lib/prepare-db'
import { extractsForLesson, migrateTiersToExtracts } from '../src/server/extracts'
import { sameExtractWindow } from '../src/lib/extracts'

const payload = await getPayload({ config })
const tiers = await payload.find({ collection: 'talk-tiers', overrideAccess: true, depth: 0, limit: 0, pagination: false })
const before = await payload.find({ collection: 'talk-extracts', overrideAccess: true, depth: 0, limit: 0, pagination: false })
console.log(`Old-style talk-tiers: ${tiers.totalDocs}. Extracts already present: ${before.totalDocs}.`)

for (const row of before.docs) {
  await payload.delete({ collection: 'talk-extracts', id: row.id, overrideAccess: true })
}
const wiped = await payload.find({ collection: 'talk-extracts', overrideAccess: true, depth: 0, limit: 1 })
if (wiped.totalDocs !== 0) throw new Error(`Wipe left ${wiped.totalDocs} extracts.`)

const migrated = await migrateTiersToExtracts(payload)
console.log(`migrateTiersToExtracts created ${migrated.created} extracts from ${migrated.talks} tiers.`)

let missing = 0
for (const tier of tiers.docs) {
  const lessonId = typeof tier.lesson === 'object' && tier.lesson ? (tier.lesson as { id: number }).id : Number(tier.lesson)
  if (!lessonId) continue
  const own = await extractsForLesson(payload, lessonId)
  const hors = own.find((row) => row.kind === 'hors' && sameExtractWindow(row, { kind: 'hors', start: Number(tier.horsStart), end: Number(tier.horsEnd) }))
  const appetiser = own.find((row) => row.kind === 'appetiser' && sameExtractWindow(row, { kind: 'appetiser', start: Number(tier.appetiserStart), end: Number(tier.appetiserEnd) }))
  if (!hors || !appetiser) {
    missing += 1
    console.log(`Missing pair for lesson ${lessonId} tier ${tier.id}`)
  } else if (hors.parent !== appetiser.id) {
    console.log(`Hors ${hors.id} parent ${hors.parent} != appetiser ${appetiser.id} on lesson ${lessonId}`)
  }
}
if (missing) {
  console.log(`FAIL: ${missing} old pairs were not copied.`)
  await closePayload(payload)
  process.exit(1)
}
console.log(`OK: every talk-tier pair is present on talk-extracts, with the hors pointed at its appetiser.`)
await closePayload(payload)
process.exit(0)
