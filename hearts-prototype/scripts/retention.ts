import { getPayload } from 'payload'
import config from '@payload-config'
import { runRetention } from '../src/server/retention'

const payload = await getPayload({ config })
const results = await runRetention(payload)
console.log(JSON.stringify({ ok: true, results, at: new Date().toISOString() }, null, 2))
process.exit(0)
