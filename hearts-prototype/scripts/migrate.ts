import { assertProductionEnv, isProduction } from '../src/lib/env'
import { closePayload, clearDevPushMarker } from '../src/lib/prepare-db'
import { platformClientIpHeader, trustedProxyHops } from '../src/lib/rate-limit'

// Applies schema migrations and nothing else. Safe to run more than once. Never wipes data.
if (isProduction()) assertProductionEnv(process.env, { hops: trustedProxyHops(), platformHeader: platformClientIpHeader() })

await clearDevPushMarker()
const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })
await payload.db.migrate()
console.log('Database migrations are up to date.')
await closePayload(payload)
process.exit(0)
