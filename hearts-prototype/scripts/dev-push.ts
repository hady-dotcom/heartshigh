import { getPayload } from 'payload'
import config from '../src/payload.config'
import { isRemoteDatabase } from '../src/lib/env'

if (process.env.HEARTS_DB_PUSH !== '1' || process.env.NODE_ENV === 'production' || isRemoteDatabase()) {
  console.error('This only pushes a database on this computer, and only when HEARTS_DB_PUSH=1. It does not run in production.')
  process.exit(1)
}

const payload = await getPayload({ config })
const found = await payload.find({ collection: 'users', limit: 1, overrideAccess: true })
console.log('pushed users', found.totalDocs)
process.exit(0)
