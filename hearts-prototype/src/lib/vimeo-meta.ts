export type VimeoMeta = { durationSeconds: number; posterUrl: string; hash: string; pageSeen?: boolean }

const VIMEO_ID = /^\d{6,12}$/
const HASH = /[0-9a-f]{6,20}/i

export function shouldFetchVimeo(env: Record<string, string | undefined> = process.env) {
  if (env.HEARTS_E2E === '1' || env.HEARTS_BUILD === '1' || env.NODE_ENV === 'test') return false
  return true
}

/** Unlisted films only answer oEmbed, and only play, when the privacy hash is in the link. */
export function vimeoOembedUrl(id: string, hash = '') {
  const page = hash && HASH.test(hash) ? `https://vimeo.com/${id}/${hash}` : `https://vimeo.com/${id}`
  return `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(page)}`
}

/** The hash Vimeo puts on the player link in the public page, including twitter:player. */
export function vimeoHashFromHtml(html: string, id: string) {
  if (!VIMEO_ID.test(id)) return ''
  const match = String(html || '').match(new RegExp(`player\\.vimeo\\.com/video/${id}(?:\\?|&amp;|&)h=(${HASH.source})`, 'i'))
  return match?.[1] || ''
}

/** Duration, thumbnail and privacy hash from a Vimeo oEmbed body. Anything else is dropped. */
export function readVimeoOembed(body: unknown): VimeoMeta {
  const row = body && typeof body === 'object' ? (body as { duration?: unknown; thumbnail_url?: unknown; html?: unknown }) : {}
  const duration = Number(row.duration)
  const poster = typeof row.thumbnail_url === 'string' ? row.thumbnail_url.trim() : ''
  const html = typeof row.html === 'string' ? row.html : ''
  const fromHtml = html.match(new RegExp(`[?&]h=(${HASH.source})`, 'i'))
  return {
    durationSeconds: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 0,
    posterUrl: /^https:\/\//i.test(poster) && !/^https?:\/\/[^/]*javascript:/i.test(poster) ? poster : '',
    hash: fromHtml?.[1] || '',
  }
}

/** A real Vimeo page, or a challenge page we should try again later. */
export async function discoverVimeoPage(id: string, fetchImpl: typeof fetch = fetch) {
  if (!VIMEO_ID.test(id)) return { hash: '', seen: false }
  try {
    const response = await fetchImpl(`https://vimeo.com/${id}`, {
      signal: AbortSignal.timeout(3500),
      headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0' },
    })
    if (!response.ok) return { hash: '', seen: false }
    const html = await response.text()
    const hash = vimeoHashFromHtml(html, id)
    if (hash) return { hash, seen: true }
    const wall = /<h1>Verify to continue<\/h1>|cf-turnstile/i.test(html) && !new RegExp(`player\\.vimeo\\.com/video/${id}`, 'i').test(html)
    if (wall) return { hash: '', seen: false }
    return { hash: '', seen: true }
  } catch {
    return { hash: '', seen: false }
  }
}

export async function discoverVimeoHash(id: string, fetchImpl: typeof fetch = fetch) {
  return (await discoverVimeoPage(id, fetchImpl)).hash
}

async function readOembed(id: string, hash: string, fetchImpl: typeof fetch) {
  const response = await fetchImpl(vimeoOembedUrl(id, hash), { signal: AbortSignal.timeout(3500) })
  if (!response.ok) return null
  const meta = readVimeoOembed(await response.json())
  if (hash && HASH.test(hash) && !meta.hash) meta.hash = hash
  if (!meta.durationSeconds && !meta.posterUrl && !meta.hash) return null
  return meta
}

export async function fetchVimeoMeta(id: string, fetchImpl: typeof fetch = fetch, hash = ''): Promise<VimeoMeta | null> {
  if (!VIMEO_ID.test(id)) return null
  try {
    const hashed = hash && HASH.test(hash) ? await readOembed(id, hash, fetchImpl) : null
    if (hashed && (hashed.durationSeconds || hashed.posterUrl)) return hashed
    const bare = await readOembed(id, '', fetchImpl)
    if (bare) {
      if (hash && HASH.test(hash) && !bare.hash) bare.hash = hash
      return bare
    }
    return hashed
  } catch {
    return null
  }
}

/** Looks up many films. Stops when the budget runs out and returns what it has. */
export async function fetchVimeoMetas(ids: string[], opts?: { budgetMs?: number; fetchImpl?: typeof fetch }) {
  const unique = [...new Set(ids.filter((id) => VIMEO_ID.test(id)))]
  const out = new Map<string, VimeoMeta>()
  const budget = opts?.budgetMs ?? 90_000
  const fetchImpl = opts?.fetchImpl || fetch
  const deadline = Date.now() + budget
  let cursor = 0
  async function worker() {
    while (cursor < unique.length && Date.now() < deadline) {
      const id = unique[cursor]
      cursor += 1
      const page = await discoverVimeoPage(id, fetchImpl)
      const meta = await fetchVimeoMeta(id, fetchImpl, page.hash)
      if (meta) out.set(id, { ...meta, pageSeen: page.seen })
      else if (page.hash) out.set(id, { durationSeconds: 0, posterUrl: '', hash: page.hash, pageSeen: true })
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, unique.length) }, () => worker()))
  return out
}
