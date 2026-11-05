/**
 * Vimeo links for Bring in. A private ("unlisted") Vimeo film needs its hash to play,
 * so the hash is kept next to the number. Words come from Vimeo's own caption files,
 * read with a token from the owner's Vimeo account (VIMEO_TOKEN, server only).
 */

export const VIMEO_KEY_MISSING = 'Add your Vimeo key to pull words.'

/** The plain status line for a Vimeo talk still waiting for words, or '' when the note is not a Vimeo one. */
export function vimeoWaitingLabel(note: string | null | undefined) {
  const text = String(note || '')
  if (text.includes(VIMEO_KEY_MISSING)) return `${VIMEO_KEY_MISSING} Then paste the link again.`
  if (/no captions on Vimeo yet/i.test(text)) return 'No captions on Vimeo yet. Turn on auto captions in Vimeo, then paste the link again.'
  return ''
}

export type VimeoLink = { id: string; hash: string; url: string }

const HASH = /^[0-9a-f]{6,20}$/i

export function looksLikeVimeo(input: string) {
  try {
    const host = new URL(input.trim()).hostname.replace(/^www\./, '')
    return host === 'vimeo.com' || host === 'player.vimeo.com'
  } catch {
    return false
  }
}

/** vimeo.com/123, vimeo.com/123/abc, vimeo.com/123?h=abc, player.vimeo.com/video/123?h=abc, vimeo.com/channels/x/123. */
export function parseVimeoLink(input: string): VimeoLink | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\./, '')
  if (host !== 'vimeo.com' && host !== 'player.vimeo.com') return null
  const parts = url.pathname.split('/').filter(Boolean)
  let at = -1
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^\d{6,12}$/.test(parts[i])) {
      at = i
      break
    }
  }
  if (at < 0) return null
  const id = parts[at]
  const pathHash = parts[at + 1] && HASH.test(parts[at + 1]) ? parts[at + 1] : ''
  const queryHash = String(url.searchParams.get('h') || '')
  const hash = HASH.test(queryHash) ? queryHash : pathHash
  return { id, hash, url: hash ? `https://vimeo.com/${id}/${hash}` : `https://vimeo.com/${id}` }
}

/** The player link. The hash goes in as ?h= so unlisted films play. */
export function vimeoPlayerSrc(id: string, hash?: string | null, extra: Record<string, string> = {}) {
  const params = new URLSearchParams()
  if (hash && HASH.test(hash)) params.set('h', hash)
  for (const [key, value] of Object.entries(extra)) params.set(key, value)
  const query = params.toString()
  return `https://player.vimeo.com/video/${id}${query ? `?${query}` : ''}`
}

export type VimeoTrack = { type?: string; language?: string; link?: string; active?: boolean; name?: string; id?: number | string }

/** Uploaded captions first, then subtitles, then Vimeo's auto captions. The wanted language beats any other. */
export function pickVimeoTrack(tracks: VimeoTrack[], lang = 'en'): VimeoTrack | null {
  const usable = tracks.filter((track) => track.link)
  if (!usable.length) return null
  const want = lang.toLowerCase().split('-')[0]
  const isAuto = (track: VimeoTrack) => /auto/i.test(String(track.name || '')) || /auto/i.test(String(track.type || '')) || /autogen/i.test(String(track.language || ''))
  const score = (track: VimeoTrack) => {
    const language = String(track.language || '').toLowerCase().split(/[-_]/)[0]
    let points = 0
    if (language === want) points += 100
    if (!isAuto(track)) points += 20
    if (track.type === 'captions') points += 5
    else if (track.type === 'subtitles') points += 4
    if (track.active) points += 1
    return points
  }
  return [...usable].sort((a, b) => score(b) - score(a))[0]
}

export type VimeoMeta = { id: string; title: string; author: string; thumbnail: string; durationSeconds: number | null }

export type VimeoIngest =
  | { ok: true; meta: VimeoMeta | null; transcript: string; durationSeconds: number | null; note: string }
  | { ok: false; meta: VimeoMeta | null; durationSeconds: number | null; reason: 'no-key' | 'no-captions' | 'not-found' | 'failed'; note: string }

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

function apiPath(link: VimeoLink) {
  return link.hash ? `${link.id}:${link.hash}` : link.id
}

async function json(fetcher: Fetcher, url: string, token?: string) {
  const response = await fetcher(url, {
    headers: { Accept: 'application/vnd.vimeo.*+json;version=3.4', ...(token ? { Authorization: `bearer ${token}` } : {}) },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) return { status: response.status, body: null as unknown }
  return { status: response.status, body: (await response.json()) as unknown }
}

/** Title, maker and length. With a key this uses the Vimeo API; without one, Vimeo's public oEmbed page. */
export async function vimeoMeta(link: VimeoLink, options: { token?: string; fetcher?: Fetcher } = {}): Promise<VimeoMeta | null> {
  const fetcher = options.fetcher || fetch
  try {
    if (options.token) {
      const found = await json(fetcher, `https://api.vimeo.com/videos/${apiPath(link)}?fields=name,duration,user.name,pictures.base_link`, options.token)
      const body = found.body as { name?: string; duration?: number; user?: { name?: string }; pictures?: { base_link?: string } } | null
      if (body) {
        return { id: link.id, title: String(body.name || ''), author: String(body.user?.name || ''), thumbnail: String(body.pictures?.base_link || ''), durationSeconds: Number(body.duration) > 0 ? Number(body.duration) : null }
      }
    }
    const found = await json(fetcher, `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(link.url)}`)
    const body = found.body as { title?: string; author_name?: string; thumbnail_url?: string; duration?: number } | null
    if (!body) return null
    return { id: link.id, title: String(body.title || ''), author: String(body.author_name || ''), thumbnail: String(body.thumbnail_url || ''), durationSeconds: Number(body.duration) > 0 ? Number(body.duration) : null }
  } catch {
    return null
  }
}

/** Looks the film up, then reads the best caption file Vimeo has for it. Never throws. */
export async function ingestVimeoLink(link: VimeoLink, options: { token?: string; fetcher?: Fetcher; lang?: string } = {}): Promise<VimeoIngest> {
  const fetcher = options.fetcher || fetch
  const token = (options.token ?? process.env.VIMEO_TOKEN ?? '').trim()
  const meta = await vimeoMeta(link, { token, fetcher })
  const durationSeconds = meta?.durationSeconds ?? null
  if (!token) return { ok: false, meta, durationSeconds, reason: 'no-key', note: VIMEO_KEY_MISSING }
  try {
    const found = await json(fetcher, `https://api.vimeo.com/videos/${apiPath(link)}/texttracks?per_page=100`, token)
    if (found.status === 404) return { ok: false, meta, durationSeconds, reason: 'not-found', note: 'Vimeo could not find this film with your key. Check the link, and that the film is in your account.' }
    if (!found.body) return { ok: false, meta, durationSeconds, reason: 'failed', note: `Vimeo said no (${found.status}). Check your Vimeo key.` }
    const tracks = ((found.body as { data?: VimeoTrack[] }).data || []) as VimeoTrack[]
    const track = pickVimeoTrack(tracks, options.lang || 'en')
    if (!track?.link) return { ok: false, meta, durationSeconds, reason: 'no-captions', note: 'This film has no captions on Vimeo yet. Turn on auto captions in Vimeo, then try again.' }
    const response = await fetcher(track.link, { signal: AbortSignal.timeout(20000) })
    const text = response.ok ? await response.text() : ''
    if (!text.trim()) return { ok: false, meta, durationSeconds, reason: 'failed', note: 'Vimeo gave an empty caption file.' }
    return { ok: true, meta, transcript: text, durationSeconds, note: 'Words pulled from Vimeo.' }
  } catch {
    return { ok: false, meta, durationSeconds, reason: 'failed', note: 'Could not reach Vimeo. Try again later.' }
  }
}
