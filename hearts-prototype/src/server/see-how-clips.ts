import type { Payload } from 'payload'
import { seeHowManifest } from '@/lib/see-how'

const VIDEO = /\.(webm|mp4|mov)$/i
const MIME = new Set(['video/webm', 'video/mp4', 'video/quicktime'])
const MAX = 30 * 1024 * 1024

export function seeHowFilePath(filename: string) {
  return `/api/see-how-clips/file/${encodeURIComponent(filename)}`
}

/** Page id → public file URL for every clip the master desk has replaced. */
export async function seeHowClipMap(payload: Payload) {
  const found = await payload.find({
    collection: 'see-how-clips',
    overrideAccess: true,
    depth: 0,
    limit: 300,
  })
  const clips: Record<string, string> = {}
  for (const doc of found.docs) {
    const page = String((doc as { page?: unknown }).page || '')
    const filename = String((doc as { filename?: unknown }).filename || '')
    if (!page || !filename || !seeHowManifest.pages[page]) continue
    clips[page] = seeHowFilePath(filename)
  }
  return clips
}

async function rowsFor(payload: Payload, page: string) {
  const found = await payload.find({
    collection: 'see-how-clips',
    overrideAccess: true,
    depth: 0,
    limit: 10,
    where: { page: { equals: page } },
  })
  return found.docs
}

export async function resetSeeHowClip(payload: Payload, page: string) {
  if (!seeHowManifest.pages[page]) return { error: 'That page has no See how clip.' }
  const docs = await rowsFor(payload, page)
  for (const doc of docs) {
    await payload.delete({ collection: 'see-how-clips', id: doc.id, overrideAccess: true })
  }
  return { notice: 'Back to the recorded one.' }
}

export async function replaceSeeHowClip(payload: Payload, page: string, file: File) {
  if (!seeHowManifest.pages[page]) return { error: 'That page has no See how clip.' }
  if (!file || file.size === 0) return { error: 'Choose a video to replace this clip.' }
  if (file.size > MAX) return { error: 'Keep the video under 30 MB.' }
  const mime = (file.type || '').toLowerCase()
  if (!MIME.has(mime) && !VIDEO.test(file.name)) return { error: 'Use a WebM, MP4 or MOV video.' }
  const bytes = Buffer.from(await file.arrayBuffer())
  const name = file.name.replace(/[^\w.\-]+/g, '-').replace(/^\.+/, '').slice(0, 80) || 'clip.webm'
  const docs = await rowsFor(payload, page)
  const upload = {
    data: { page, alt: seeHowManifest.pages[page].title },
    file: { data: bytes, mimetype: MIME.has(mime) ? mime : 'video/mp4', name, size: bytes.length },
    overrideAccess: true as const,
  }
  if (docs[0]) {
    await payload.update({ collection: 'see-how-clips', id: docs[0].id, ...upload })
    for (const extra of docs.slice(1)) {
      await payload.delete({ collection: 'see-how-clips', id: extra.id, overrideAccess: true })
    }
  } else {
    await payload.create({ collection: 'see-how-clips', ...upload })
  }
  return { notice: 'Your video is the one people will see.' }
}
