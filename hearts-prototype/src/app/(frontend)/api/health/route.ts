import config from '@payload-config'
import { getPayload } from 'payload'
import { databaseKind, readS3 } from '@/lib/env'
import { logError } from '@/lib/log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** A cheap check for the host’s health probe. It does not print secrets or create any data. */
export async function GET() {
  try {
    const payload = await getPayload({ config })
    await payload.find({ collection: 'users', depth: 0, limit: 1, overrideAccess: true })
    return Response.json({ ok: true, database: databaseKind(), storage: readS3() ? 's3' : 'local' })
  } catch (error) {
    logError('health', error)
    return Response.json({ ok: false }, { status: 503 })
  }
}
