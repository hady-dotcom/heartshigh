import { getPayloadClient } from '@/server/context'
import { json, readBody } from '@/server/api'
import { now } from '@/lib/clock'

export const dynamic = 'force-dynamic'

const VIDEO_GONE = new Set([100, 101, 150])
const CLIENT_SIDE = new Set([2, 5])

/** YouTube's oEmbed answers 401 or 404 for removed and embed-blocked videos; anything else proves nothing. */
async function confirmedGone(youtubeId: string) {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${youtubeId}`)}`, { signal: AbortSignal.timeout(5000) })
    return [401, 403, 404].includes(response.status)
  } catch {
    return false
  }
}

/**
 * The feed reports a clip the player refused. Anyone can call this before sign-up, so a report alone never
 * hides a clip: it is taken off the feed only when YouTube itself confirms the video cannot be embedded.
 */
export async function POST(req: Request) {
  const body = await readBody(req)
  const cutId = Number(body.cutId)
  const code = Number(body.code)
  if (!cutId || !(VIDEO_GONE.has(code) || CLIENT_SIDE.has(code))) return json({ error: 'That report could not be read.' }, 400)
  const payload = await getPayloadClient()
  const cut = (await payload.findByID({ collection: 'cuts', id: cutId, overrideAccess: true, depth: 1 }).catch(() => null)) as { id: number; playable?: boolean; lesson?: { youtubeId?: string } | number } | null
  if (!cut) return json({ error: 'No such clip.' }, 404)
  const youtubeId = typeof cut.lesson === 'object' ? cut.lesson?.youtubeId : undefined
  const gone = VIDEO_GONE.has(code) && Boolean(youtubeId) && (await confirmedGone(youtubeId!))
  await payload.update({
    collection: 'cuts',
    id: cut.id,
    overrideAccess: true,
    data: { lastError: `${code} at ${now().toISOString()}${gone ? ', confirmed by YouTube' : ''}`, ...(gone ? { playable: false } : {}) } as never,
  })
  return json({ ok: true, hidden: gone })
}
