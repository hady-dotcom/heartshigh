import { getPayload } from 'payload'
import config from '../src/payload.config'
import { isProduction, isRemoteDatabase } from '../src/lib/env'
import { seedLiveDemo } from '../src/seed/live-demo'

if (isProduction() || isRemoteDatabase()) {
  console.error('Refusing to seed live sessions. This script never runs against production.')
  process.exit(1)
}

const live = process.argv.includes('--live') || process.env.LIVE_NOW === '1'
const payload = await getPayload({ config })
const result = await seedLiveDemo(payload, { live })
if (!result.ok) {
  console.error(result.reason)
  process.exit(1)
}
console.log(`Live demo on hearts-demo: ${result.created} created, ${result.reused} already there.${result.live ? ' One session is live.' : ' No live session was started.'} Other portals were left alone. Passwords were not changed.`)
process.exit(0)
