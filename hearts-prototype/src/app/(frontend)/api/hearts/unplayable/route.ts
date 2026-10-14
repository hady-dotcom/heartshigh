import { getSession } from '@/server/context'
import { json, readBody } from '@/server/api'
import { now } from '@/lib/clock'
import { hit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const VIDEO_GONE = new Set([100, 101, 150])
const CLIENT_SIDE = new Set([2, 5])

const LOOKUP_MS = 6 * 60 * 60_000
const lookups = ((globalThis as typeof globalThis & { __heartsOembed?: Map<string, { at: number; gone: boolean }> }).__heartsOembed ??= new Map())

/** YouTube's oEmbed answers 401 or 404 for removed and embed-blocked videos; anything else proves nothing. One lookup per video per six hours. */
async function confirmedGone(youtubeId: string) {
  const cached = lookups.get(youtubeId)
  if (cached && Date.now() - cached.at < LOOKUP_MS) return cached.gone
  let gone = false
  try {
    const response = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${youtubeId}`)}`, { signal: AbortSignal.timeout(5000) })
    gone = [401, 403, 404].includes(response.status)
  } catch {
    gone = false
  }
  lookups.set(youtubeId, { at: Date.now(), gone })
  return gone
}

/**
 * The feed reports a clip the player refused. Signed-in accounts only, ten reports per ten minutes each, and a
 * report alone never hides a clip: it is taken off the feed only when YouTube itself confirms it cannot be embedded.
 * Before sign-up the feed skips the clip on the device and reports nothing.
 */
export async function POST(req: Request) {
  const session = await getSession({ touch: false })
  if (!session.actor) return json({ error: 'Sign in first.' }, 401)
  const limit = hit(`unplayable:${session.actor.id}`, 10, 10 * 60_000)
  if (!limit.allowed) return json({ error: 'Too many reports. Try again later.' }, 429)
  const body = await readBody(req)
  const cutId = Number(body.cutId)
  const code = Number(body.code)
  if (!cutId || !(VIDEO_GONE.has(code) || CLIENT_SIDE.has(code))) return json({ error: 'That report could not be read.' }, 400)
  const payload = session.payload
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
