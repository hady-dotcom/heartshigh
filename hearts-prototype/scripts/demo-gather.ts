import { getPayload } from 'payload'
import config from '../src/payload.config'
import { seedGatherDemo } from '../src/seed/gather-demo'

const payload = await getPayload({ config })
const result = await seedGatherDemo(payload)
if (!result.ok) {
  console.error(result.reason)
  process.exit(1)
}
console.log(`Gather demo on hearts-demo: ${result.created} created, ${result.reused} already there. Other portals were left alone.`)
process.exit(0)
