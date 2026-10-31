import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { backgroundKey } from '@/lib/backgrounds'
import { readS3, type S3Settings } from '@/lib/env'

export const dynamic = 'force-dynamic'

/** How long the signed link works. The redirect is cached for well under this, so a cached redirect never points at a dead link. */
const SIGNED_SECONDS = 60 * 60
const REDIRECT_CACHE = 'public, max-age=600, s-maxage=600'

let client: { settings: string; s3: S3Client } | null = null

function s3For(settings: S3Settings) {
  const key = JSON.stringify(settings)
  if (client?.settings !== key) {
    client = {
      settings: key,
      s3: new S3Client({
        credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
        region: settings.region,
        endpoint: settings.endpoint,
        forcePathStyle: settings.forcePathStyle,
      }),
    }
  }
  return client.s3
}

function notFound() {
  return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain' } })
}

/** The bucket is private: a catalogue still is served as a redirect to a short-lived signed GET, and anything else is a 404. */
export async function GET(_request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const key = backgroundKey((await context.params).path || [])
  if (!key) return notFound()
  const settings = readS3()
  if (!settings) return notFound()
  const location = await getSignedUrl(s3For(settings), new GetObjectCommand({ Bucket: settings.bucket, Key: key }), { expiresIn: SIGNED_SECONDS })
  return new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': REDIRECT_CACHE } })
}

export const HEAD = GET
