import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { NextResponse } from 'next/server'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { canReadMedia } from '@/lib/media-access'
import { readS3 } from '@/lib/env'
import { getSession } from '@/server/context'
import { findLinkedAnswer } from '@/server/media'

export const dynamic = 'force-dynamic'

const EXPIRES = 300

/** Serves a private file after the answer (or portal-asset) rules. S3 uses a short signed URL. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  const { payload, user } = await getSession()
  if (!user || !id) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const media = await payload.findByID({ collection: 'media', id, overrideAccess: true, depth: 0 }).catch(() => null) as {
    id: number
    owner?: unknown
    purpose?: string | null
    portal?: unknown
    filename?: string
    mimeType?: string
    url?: string
    prefix?: string | null
  } | null
  if (!media) return NextResponse.json({ error: 'That file is not here.' }, { status: 404 })
  const answer = await findLinkedAnswer(payload, media.id)
  if (!canReadMedia(user, media, answer, false)) return NextResponse.json({ error: 'That file is not yours to open.' }, { status: 403 })
  const settings = readS3()
  if (settings && media.filename) {
    const client = new S3Client({
      credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
      region: settings.region,
      endpoint: settings.endpoint,
      forcePathStyle: settings.forcePathStyle,
    })
    const key = [media.prefix, media.filename].filter(Boolean).join('/')
    const location = await getSignedUrl(client, new GetObjectCommand({ Bucket: settings.bucket, Key: key }), { expiresIn: EXPIRES })
    return new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'private, no-store' } })
  }
  if (!media.filename) return NextResponse.json({ error: 'That file is missing.' }, { status: 404 })
  const filePath = path.join(process.cwd(), 'media', media.filename)
  const info = await stat(filePath).catch(() => null)
  if (!info) return NextResponse.json({ error: 'That file is missing.' }, { status: 404 })
  const stream = createReadStream(filePath)
  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      'Content-Type': media.mimeType || 'application/octet-stream',
      'Content-Length': String(info.size),
      'Cache-Control': 'private, no-store',
    },
  })
}
