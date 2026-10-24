import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { NextResponse } from 'next/server'
import { idOf } from '@/lib/ids'
import { getSession, visibleCourseIds } from '@/server/context'

export const dynamic = 'force-dynamic'

/** Streams an uploaded lesson film to someone who can already open that course. */
export async function GET(req: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params
  const id = Number(lessonId)
  const { payload, user } = await getSession()
  if (!user || !id) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const lesson = await payload.findByID({ collection: 'lessons', id, depth: 0, overrideAccess: true }).catch(() => null) as { course?: unknown; film?: unknown; videoProvider?: string } | null
  if (!lesson || lesson.videoProvider !== 'file') return NextResponse.json({ error: 'That film is not here.' }, { status: 404 })
  const courseId = idOf(lesson.course)
  const allowed = courseId && (await visibleCourseIds(payload, user)).includes(courseId)
  if (!allowed) return NextResponse.json({ error: 'That film is not in your courses.' }, { status: 403 })
  const mediaId = idOf(lesson.film)
  const media = mediaId ? await payload.findByID({ collection: 'media', id: mediaId, depth: 0, overrideAccess: true }).catch(() => null) as { filename?: string; mimeType?: string } | null : null
  if (!media?.filename) return NextResponse.json({ error: 'That film file is missing.' }, { status: 404 })
  const filePath = path.join(process.cwd(), 'media', media.filename)
  const info = await stat(filePath).catch(() => null)
  if (!info) return NextResponse.json({ error: 'That film file is missing.' }, { status: 404 })
  const type = media.mimeType || 'video/mp4'
  const range = req.headers.get('range')
  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range)
    const start = match ? Number(match[1]) : 0
    const end = match && match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1
    if (start >= info.size || start > end) return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${info.size}` } })
    const stream = createReadStream(filePath, { start, end })
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: {
        'Content-Type': type,
        'Content-Length': String(end - start + 1),
        'Content-Range': `bytes ${start}-${end}/${info.size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, no-store',
      },
    })
  }
  const stream = createReadStream(filePath)
  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    headers: { 'Content-Type': type, 'Content-Length': String(info.size), 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store' },
  })
}
