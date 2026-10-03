import { assertProductionEnv, isProduction } from '../src/lib/env'
import { closePayload } from '../src/lib/prepare-db'
import { platformClientIpHeader, trustedProxyHops } from '../src/lib/rate-limit'
import { importedSheetDraftIds } from '../src/server/imported-questions'

// Publishes draft questions that came in on the master sheet. Safe to run more than once:
// a question already published, rejected, or claimed on the desk is not selected again.
// Machine caption drafts and AI drafts stay waiting. Pass --dry-run to count without writing.
if (isProduction()) assertProductionEnv(process.env, { hops: trustedProxyHops(), platformHeader: platformClientIpHeader() })

const dryRun = process.argv.includes('--dry-run')
const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })
const ids = await importedSheetDraftIds(payload)
if (!dryRun) {
  for (const id of ids) {
    await payload.update({ collection: 'engagement-points', id, overrideAccess: true, data: { status: 'published' } as never })
  }
}
const verb = dryRun ? 'Would publish' : 'Published'
console.log(`${verb} ${ids.length} imported question${ids.length === 1 ? '' : 's'}.`)
console.log('Machine drafts, desk drafts and questions a person already reviewed stay as they are.')
await closePayload(payload)
process.exit(0)
