/**
 * Talks currently hidden for being under five minutes.
 *
 *   npm run report:short-talks
 */
import { closePayload, clearDevPushMarker } from '../src/lib/prepare-db'
import { listShortTalks } from '../src/server/short-talks'

await clearDevPushMarker()
const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })

try {
  const talks = await listShortTalks(payload)
  console.log(`${talks.length} talk${talks.length === 1 ? '' : 's'} under 5 minutes`)
  for (const talk of talks) {
    console.log(`${talk.title}\t${talk.speaker}\t${talk.length}`)
  }
} finally {
  await closePayload(payload)
}
process.exit(0)
