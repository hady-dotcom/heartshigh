import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Payload } from 'payload'
import { fetchVimeoMetas, shouldFetchVimeo, type VimeoMeta } from '@/lib/vimeo-meta'
import { misplacedHomeAnswers } from '@/lib/said-answers'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

type LessonRow = {
  id: number
  vimeoId?: string | null
  vimeoHash?: string | null
  durationSeconds?: number | null
  posterUrl?: string | null
}

const PAGE = 100
const PAGES = 8

/** Lengths and pictures captured from Vimeo oEmbed, so a boot can fill films without calling Vimeo again. */
export function loadStoredVimeoMetas() {
  const map = new Map<string, VimeoMeta>()
  const file = path.join(root, 'uploads/vimeo-meta.json')
  if (!existsSync(file)) return map
  const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
  for (const [id, value] of Object.entries(raw)) {
    if (!/^\d{6,12}$/.test(id) || !Array.isArray(value)) continue
    const duration = Number(value[0] || 0)
    const poster = String(value[1] || '')
    if (!duration && !poster.startsWith('https://')) continue
    map.set(id, { durationSeconds: duration > 0 ? Math.round(duration) : 0, posterUrl: poster.startsWith('https://') ? poster : '', hash: '' })
  }
  return map
}

/** Writes stored lengths and pictures onto films that are still missing them. Safe to run again. */
export async function applyStoredVimeoMeta(payload: Payload, metas = loadStoredVimeoMetas()) {
  if (!metas.size) return { updated: 0 }
  let updated = 0
  for (let page = 1; page <= PAGES; page += 1) {
    const found = await payload.find({
      collection: 'lessons',
      overrideAccess: true,
      depth: 0,
      limit: PAGE,
      page,
      where: { vimeoId: { exists: true } },
    })
    for (const row of found.docs as LessonRow[]) {
      const meta = metas.get(String(row.vimeoId || '').trim())
      if (!meta) continue
      const data: { durationSeconds?: number; posterUrl?: string } = {}
      if (!Number(row.durationSeconds) && meta.durationSeconds) data.durationSeconds = meta.durationSeconds
      if (!String(row.posterUrl || '').trim() && meta.posterUrl) data.posterUrl = meta.posterUrl
      if (!Object.keys(data).length) continue
      await payload.update({ collection: 'lessons', id: row.id, overrideAccess: true, data })
      updated += 1
    }
    if (!found.hasNextPage) break
  }
  return { updated }
}

function needsVimeo(row: LessonRow) {
  const id = String(row.vimeoId || '').trim()
  if (!/^\d{6,12}$/.test(id)) return false
  return !Number(row.durationSeconds) || !String(row.posterUrl || '').trim() || !String(row.vimeoHash || '').trim()
}

/** Domains the player is allowed to send as the referrer. Unlisted films still need their hash. */
export function vimeoEmbedDomains(env: Record<string, string | undefined> = process.env) {
  const extra = String(env.HEARTS_EMBED_DOMAINS || '')
    .split(',')
    .map((item) => item.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
    .filter(Boolean)
  return [...new Set(['heartshigh-production.up.railway.app', ...extra])]
}

const HEX_HASH = /^[0-9a-f]{6,20}$/i

/** Adds this app to a film's embed allow-list when a Vimeo key is present. A public film is left public. Never throws. */
export async function allowVimeoEmbed(id: string, hash: string, token: string, domains: string[], fetchImpl: typeof fetch = fetch) {
  if (!token || !/^\d{6,12}$/.test(id) || !domains.length) return
  const safeHash = HEX_HASH.test(hash) ? hash : ''
  const path = safeHash ? `${id}:${safeHash}` : id
  const headers = { Authorization: `bearer ${token}`, Accept: 'application/vnd.vimeo.*+json;version=3.4', 'Content-Type': 'application/json' }
  try {
    const current = await fetchImpl(`https://api.vimeo.com/videos/${path}?fields=privacy.embed`, { headers, signal: AbortSignal.timeout(4000) })
    const body = current.ok ? ((await current.json()) as { privacy?: { embed?: string } }) : null
    const embed = String(body?.privacy?.embed || '')
    if (embed === 'public') return
    if (embed && embed !== 'whitelist') {
      await fetchImpl(`https://api.vimeo.com/videos/${path}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ privacy: { embed: 'whitelist' } }),
        signal: AbortSignal.timeout(4000),
      })
    }
    for (const domain of domains) {
      await fetchImpl(`https://api.vimeo.com/videos/${path}/privacy/domains/${encodeURIComponent(domain)}`, {
        method: 'PUT',
        headers,
        signal: AbortSignal.timeout(4000),
      })
    }
  } catch {
    /* A missing key or a refused film must not stop the length and thumbnail fill. */
  }
}

/** Fills missing Vimeo lengths, thumbnails and privacy hashes. Safe to run again. Skipped in tests. */
export async function backfillVimeoFilms(payload: Payload) {
  if (!shouldFetchVimeo()) return { updated: 0 }
  const missing: LessonRow[] = []
  for (let page = 1; page <= PAGES; page += 1) {
    const found = await payload.find({
      collection: 'lessons',
      overrideAccess: true,
      depth: 0,
      limit: PAGE,
      page,
      where: { vimeoId: { exists: true } },
    })
    missing.push(...(found.docs as LessonRow[]).filter(needsVimeo))
    if (!found.hasNextPage) break
  }
  if (!missing.length) return { updated: 0 }
  const rank = (row: LessonRow) => {
    const id = String(row.vimeoId || '')
    const bare = !Number(row.durationSeconds) || !String(row.posterUrl || '').trim()
    if (!bare && id.startsWith('1239')) return 0
    if (bare) return 1
    return 2
  }
  missing.sort((a, b) => rank(a) - rank(b))
  const metas = await fetchVimeoMetas(missing.map((row) => String(row.vimeoId)), { budgetMs: 120_000 })
  const token = String(process.env.VIMEO_TOKEN || '').trim()
  const domains = vimeoEmbedDomains()
  let updated = 0
  for (const row of missing) {
    const meta = metas.get(String(row.vimeoId))
    if (!meta) continue
    const data: { durationSeconds?: number; posterUrl?: string; vimeoHash?: string } = {}
    if (!Number(row.durationSeconds) && meta.durationSeconds) data.durationSeconds = meta.durationSeconds
    if (!String(row.posterUrl || '').trim() && meta.posterUrl) data.posterUrl = meta.posterUrl
    const storedHash = String(row.vimeoHash || '').trim()
    if (!storedHash && meta.hash && HEX_HASH.test(meta.hash)) data.vimeoHash = meta.hash
    else if (!storedHash && meta.pageSeen && !meta.hash && (meta.durationSeconds || meta.posterUrl || Number(row.durationSeconds) || String(row.posterUrl || '').trim())) data.vimeoHash = 'public'
    const embedHash = data.vimeoHash && HEX_HASH.test(data.vimeoHash) ? data.vimeoHash : HEX_HASH.test(storedHash) ? storedHash : HEX_HASH.test(meta.hash) ? meta.hash : ''
    if (token && embedHash) await allowVimeoEmbed(String(row.vimeoId), embedHash, token, domains)
    if (!Object.keys(data).length) continue
    await payload.update({ collection: 'lessons', id: row.id, overrideAccess: true, data })
    updated += 1
  }
  return { updated }
}

/** Takes Home Learning sample lines off Book Summaries. The parenting course is left as it is. */
export async function clearMisplacedHomeAnswers(payload: Payload) {
  const found = await payload.find({
    collection: 'courses',
    overrideAccess: true,
    depth: 0,
    limit: 40,
    where: { or: [{ id: { equals: 77 } }, { title: { like: 'Book Summar' } }] },
  })
  let cleared = 0
  for (const course of found.docs as { id: number; title?: string | null; sampleAnswers?: unknown }[]) {
    if (!misplacedHomeAnswers(course)) continue
    await payload.update({ collection: 'courses', id: course.id, overrideAccess: true, data: { sampleAnswers: [] } as never })
    cleared += 1
  }
  return { cleared }
}
