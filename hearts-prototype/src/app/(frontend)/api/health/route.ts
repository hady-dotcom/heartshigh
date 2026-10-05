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
    const email = process.env.SMTP_URL || process.env.RESEND_API_KEY ? 'on' : 'off'
    return Response.json({
      ok: true,
      database: databaseKind(),
      storage: readS3() ? 's3' : 'local',
      email,
      version: process.env.HEARTS_VERSION || process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 8) || 'dev',
    })
  } catch (error) {
    logError('health', error)
    return Response.json({ ok: false }, { status: 503 })
  }
}
