/**
 * Hide every talk under five minutes, and the clips cut from it. Restored talks stay visible.
 *
 *   npm run mark:short-talks
 */
import { closePayload, clearDevPushMarker } from '../src/lib/prepare-db'
import { markShortTalks } from '../src/server/short-talks'

await clearDevPushMarker()
const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })

try {
  const result = await markShortTalks(payload)
  console.log(`${result.marked} marked too short, ${result.already} already marked, ${result.cleared} cleared, ${result.clips} clips updated, ${result.coursesHidden} courses hidden.`)
} finally {
  await closePayload(payload)
}
process.exit(0)
