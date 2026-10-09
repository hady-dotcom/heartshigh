// Writes the blank master sheet template and an export of the library in DATABASE_URL to content/ and artifacts/.
// Run it against a freshly seeded database: npm run reseed, then npx tsx scripts/sheet-examples.ts
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { templateWorkbook } from '../src/lib/master-sheet'
import { exportBuffer } from '../src/server/master-sheet'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const payload = await getPayload({ config })
const template = await templateWorkbook()
const example = await exportBuffer(payload, { kind: 'library', portalId: null, courseId: null, desk: 'master' })
for (const dir of ['content', 'artifacts']) {
  writeFileSync(path.join(root, dir, 'hearts-master-sheet-template.xlsx'), template)
  writeFileSync(path.join(root, dir, 'hearts-master-sheet-example.xlsx'), example)
}
console.log(`Wrote the template and a ${example.length}-byte example to content/ and artifacts/.`)
process.exit(0)
