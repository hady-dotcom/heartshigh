/**
 * Fills HEARTS circle answers on talk questions and attaches the extra joining-question
 * bank to hearts-demo. Additive. Never wipes, never touches passwords.
 *
 * Local:
 *   npm run demo:circle
 *
 * On the hearts-demo host:
 *   HEARTS_DEMO=1 npm run demo:circle
 */
import { closePayload, clearDevPushMarker } from '../src/lib/prepare-db'
import { circleDemoGuard } from '../src/lib/circle-apply'
import { DEMO_PORTAL_SLUG } from '../src/lib/live'
import { fillMissingCircleAnswers } from '../src/seed/circle-seed'
import { attachExtraPlacing, ensureDefaultPlacing } from '../src/seed/placing-seed'

const guard = circleDemoGuard()
if (guard) {
  console.error(guard)
  process.exit(1)
}

await clearDevPushMarker()
const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })

try {
  const defaults = await ensureDefaultPlacing(payload)
  const portal = (await payload.find({ collection: 'portals', overrideAccess: true, limit: 1, where: { slug: { equals: DEMO_PORTAL_SLUG } } })).docs[0]
  const extras = portal ? await attachExtraPlacing(payload, portal.id) : 0
  const circle = await fillMissingCircleAnswers(payload)
  if (!portal) {
    console.log(`hearts-demo portal was not found. Joining extras were not attached. Circle fill still ran on every talk question.`)
  }
  console.log(`hearts-demo swarm apply: ${circle.added} circle answers added, ${circle.skipped} questions already had enough. ${defaults} default joining questions added, ${extras} extra joining questions attached to ${DEMO_PORTAL_SLUG}. Other portals were left as they were. Nothing was wiped.`)
} finally {
  await closePayload(payload)
}
process.exit(0)
