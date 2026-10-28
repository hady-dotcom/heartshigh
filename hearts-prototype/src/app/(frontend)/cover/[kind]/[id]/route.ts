import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import config from '@payload-config'
import { getPayload } from 'payload'
import { coverColor, coverHue, coverSvg, type CoverKind } from '@/lib/cover-art'
import { idOf } from '@/lib/ids'
import { coverContentType, readCoverIndex, resolveSuppliedCover, suppliedCoverRoot, type CoverFrame } from '@/lib/supplied-cover'
import { findCoverPhoto } from '@/lib/cover-pick'

export const dynamic = 'force-dynamic'

type Doc = { id?: number; title?: string | null; course?: unknown; cover?: unknown }

function kindOf(value: string): CoverKind | null {
  return value === 'course' || value === 'film' ? value : null
}

async function uploaded(payload: Awaited<ReturnType<typeof getPayload>>, mediaId: number) {
  const media = await payload.findByID({ collection: 'media', id: mediaId, depth: 0, overrideAccess: true }).catch(() => null) as {
    filename?: string | null
    mimeType?: string | null
    url?: string | null
  } | null
  if (!media?.mimeType?.startsWith('image/')) return null
  if (media.url && /^https?:\/\//i.test(media.url)) return Response.redirect(media.url, 302)
  if (!media.filename) return null
  const filePath = path.join(process.cwd(), 'media', media.filename)
  const info = await stat(filePath).catch(() => null)
  if (!info) return null
  const stream = createReadStream(filePath)
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      'Content-Type': media.mimeType,
      'Content-Length': String(info.size),
      'Cache-Control': 'public, max-age=3600',
    },
  })
}

function photograph(file: string, mime: string) {
  const info = stat(file)
  return info.then((found) => {
    const stream = createReadStream(file)
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        'Content-Type': mime,
        'Content-Length': String(found.size),
        'Cache-Control': 'public, max-age=3600',
      },
    })
  }).catch(() => null)
}

/** A photograph when one is uploaded or supplied. Otherwise the drawn cover. Film stills are never used. */
export async function GET(req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind: rawKind, id: rawId } = await params
  const kind = kindOf(rawKind)
  const id = Number(rawId)
  const frame: CoverFrame = new URL(req.url).searchParams.get('shape') === 'tall' ? 'tall' : 'wide'
  if (!kind || !id) return new Response('Not found', { status: 404 })
  const payload = await getPayload({ config })
  const doc = await payload.findByID({
    collection: kind === 'course' ? 'courses' : 'lessons',
    id,
    depth: 0,
    overrideAccess: true,
  }).catch(() => null) as Doc | null
  const mediaId = idOf(doc?.cover)
  if (mediaId) {
    const file = await uploaded(payload, mediaId)
    if (file) return file
  }
  const courseId = kind === 'course' ? id : idOf(doc?.course) || id
  const title = String(doc?.title || (kind === 'course' ? 'Course' : 'Film'))
  let courseTitle = kind === 'course' ? title : ''
  if (kind === 'film' && courseId) {
    const course = await payload.findByID({ collection: 'courses', id: courseId, depth: 0, overrideAccess: true }).catch(() => null) as Doc | null
    courseTitle = String(course?.title || '')
  }
  const root = suppliedCoverRoot()
  const supplied = resolveSuppliedCover({
    root,
    kind,
    id,
    title,
    frame,
    courseId: kind === 'film' ? courseId : undefined,
    courseTitle,
    index: readCoverIndex(root),
  })
  if (supplied) {
    const mime = coverContentType(supplied)
    const file = mime ? await photograph(supplied, mime) : null
    if (file) return file
  }
  const picked = await findCoverPhoto(courseTitle || title, `${kind}:${id}:${frame}`)
  if (picked) {
    return Response.redirect(picked.url, 302)
  }
  const hue = coverHue(courseId, kind === 'film' ? id : undefined)
  const svg = coverSvg({ seed: `${kind}:${id}`, title, hue, wide: kind === 'course' })
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
      'X-Cover-Hue': coverColor(courseId, kind === 'film' ? id : undefined),
    },
  })
}
