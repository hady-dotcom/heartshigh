export type VimeoMeta = { durationSeconds: number; posterUrl: string }

const VIMEO_ID = /^\d{6,12}$/

export function shouldFetchVimeo(env: Record<string, string | undefined> = process.env) {
  if (env.HEARTS_E2E === '1' || env.HEARTS_BUILD === '1' || env.NODE_ENV === 'test') return false
  return true
}

export function vimeoOembedUrl(id: string) {
  return `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${id}`)}`
}

/** Duration and thumbnail from a Vimeo oEmbed body. Anything else is dropped. */
export function readVimeoOembed(body: unknown): VimeoMeta {
  const row = body && typeof body === 'object' ? (body as { duration?: unknown; thumbnail_url?: unknown }) : {}
  const duration = Number(row.duration)
  const poster = typeof row.thumbnail_url === 'string' ? row.thumbnail_url.trim() : ''
  return {
    durationSeconds: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 0,
    posterUrl: /^https:\/\//i.test(poster) && !/^https?:\/\/[^/]*javascript:/i.test(poster) ? poster : '',
  }
}

export async function fetchVimeoMeta(id: string, fetchImpl: typeof fetch = fetch): Promise<VimeoMeta | null> {
  if (!VIMEO_ID.test(id)) return null
  try {
    const response = await fetchImpl(vimeoOembedUrl(id), { signal: AbortSignal.timeout(4000) })
    if (!response.ok) return null
    const meta = readVimeoOembed(await response.json())
    if (!meta.durationSeconds && !meta.posterUrl) return null
    return meta
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
      const meta = await fetchVimeoMeta(id, fetchImpl)
      if (meta) out.set(id, meta)
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, unique.length) }, () => worker()))
  return out
}
