import { writeFileSync } from 'node:fs'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { closePayload } from '../src/lib/prepare-db'

const dest = process.argv[2]
if (!dest) {
  console.error('Usage: tsx scripts/write-migration-snapshot.ts <file.json>')
  process.exit(1)
}

const payload = await getPayload({ config })
const adapter = payload.db as { schema?: unknown; requireDrizzleKit?: () => { generateDrizzleJson: (schema: unknown) => Promise<unknown> | unknown } }
if (!adapter.requireDrizzleKit || !adapter.schema) {
  throw new Error('This adapter cannot write a Drizzle snapshot.')
}
const { generateDrizzleJson } = adapter.requireDrizzleKit()
const snapshot = await generateDrizzleJson(adapter.schema)
writeFileSync(dest, `${JSON.stringify(snapshot, null, 2)}\n`)
console.log(`Wrote ${dest}`)
await closePayload(payload)
process.exit(0)
