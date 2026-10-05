import { randomUUID } from 'node:crypto'
import type { Payload } from 'payload'
import type { MediaPurpose } from '@/lib/media-access'

export async function saveOwnedMedia(
  payload: Payload,
  file: File,
  opts: { portal: number | null; owner?: number | null; purpose: MediaPurpose; alt?: string; fallbackType?: string },
) {
  const ext = (file.name.match(/\.[a-z0-9]{1,5}$/i)?.[0] || '').toLowerCase()
  const media = await payload.create({
    collection: 'media',
    overrideAccess: true,
    data: {
      alt: (opts.alt || file.name).slice(0, 120),
      portal: opts.portal || undefined,
      owner: opts.owner || undefined,
      purpose: opts.purpose,
    } as never,
    file: {
      data: Buffer.from(await file.arrayBuffer()),
      mimetype: file.type || opts.fallbackType || 'application/octet-stream',
      name: `${randomUUID()}${ext}`,
      size: file.size,
    },
  })
  return media.id as number
}

export async function findLinkedAnswer(payload: Payload, mediaId: number) {
  const found = await payload.find({
    collection: 'answers',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { or: [{ image: { equals: mediaId } }, { audio: { equals: mediaId } }, { video: { equals: mediaId } }] },
  })
  if (found.docs[0]) {
    return found.docs[0] as {
      user?: unknown
      portal?: unknown
      keepPrivate?: boolean
      shareWithTeacher?: boolean
      shareWithLearners?: boolean
    }
  }
  const notes = await payload.find({
    collection: 'feedback-notes',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { audio: { equals: mediaId } },
  })
  const note = notes.docs[0] as { answer?: unknown } | undefined
  const answerId =
    typeof note?.answer === 'object' && note?.answer && 'id' in note.answer ? (note.answer as { id: number }).id : Number(note?.answer)
  if (!answerId) return null
  const answer = await payload.findByID({ collection: 'answers', id: answerId, overrideAccess: true, depth: 0 }).catch(() => null)
  return answer as {
    user?: unknown
    portal?: unknown
    keepPrivate?: boolean
    shareWithTeacher?: boolean
    shareWithLearners?: boolean
  } | null
}
