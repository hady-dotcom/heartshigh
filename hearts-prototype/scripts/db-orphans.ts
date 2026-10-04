/**
 * Read-only report of rows that point at a portal or user that no longer exists,
 * and media rows whose portal is gone. Safe to run on live.
 * Pass --fix only after reading the list; that deletes the orphan rows.
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { findOrphans, fixOrphans, formatOrphanReport } from '../src/server/erase/orphans'
import { closePayload } from '../src/lib/prepare-db'

const fix = process.argv.includes('--fix')

const payload = await getPayload({ config })
const report = await findOrphans(payload)
const text = formatOrphanReport(report)
console.log(text)
if (fix && !report.clean) {
  console.log('Removing the orphan rows listed above.')
  const removed = await fixOrphans(payload, report)
  console.log(JSON.stringify(removed, null, 2))
  const after = await findOrphans(payload)
  console.log(formatOrphanReport(after))
}
await closePayload(payload)
process.exit(report.clean || fix ? 0 : 1)
