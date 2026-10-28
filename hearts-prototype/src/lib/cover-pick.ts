import { coverHash } from '@/lib/cover-art'

const STOP = new Set(['with', 'your', 'from', 'this', 'that', 'and', 'the', 'for', 'into', 'over', 'film', 'films', 'course', 'home', 'learning'])

const HINTS: [RegExp, string][] = [
  [/welcome|introduction/i, 'parent and child at home'],
  [/prepar|resource/i, 'parent and child at home'],
  [/working from home|work from home/i, 'parent and child at home'],
  [/working with your child/i, 'parent and child at home'],
  [/learning theor/i, 'parent helps child homework'],
  [/social and emotional/i, 'family cooking kitchen'],
  [/supporting your children|focus/i, 'parent helps child homework'],
  [/problem solving/i, 'parent helps child homework'],
  [/going further/i, 'parent and child at home'],
  [/activit/i, 'family cooking kitchen'],
  [/calm|happy children/i, 'parent and child at home'],
  [/learn and remember/i, 'parent helps child homework'],
  [/motivation|mindset/i, 'family cooking kitchen'],
  [/good school/i, 'parent and child at home'],
  [/people and work/i, 'parent and child at home'],
]

/** A Commons search for a real photograph. No model, no paid source. */
export function coverSearchQuery(title: string) {
  for (const [pattern, query] of HINTS) {
    if (pattern.test(title)) return query
  }
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP.has(word))
  const subject = words.slice(0, 5).join(' ')
  return subject ? `${subject} parent and child` : 'parent and child at home'
}

export type CoverHit = { url: string; mime: string }

const PHOTO = /^image\/(jpeg|png|webp)$/
const HOST = /^https:\/\/(upload|thumb)\.wikimedia\.org\//

export function chooseCoverHit(hits: CoverHit[], seed: string) {
  const photos = hits.filter((hit) => PHOTO.test(hit.mime) && HOST.test(hit.url))
  if (!photos.length) return null
  return photos[coverHash(seed) % photos.length]
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

const memory = new Map<string, CoverHit>()

/** Search Wikimedia Commons. The same title keeps the same picture for this process. */
export async function findCoverPhoto(title: string, seed: string, fetchImpl: FetchLike = fetch) {
  const cached = memory.get(seed)
  if (cached) return cached
  const query = coverSearchQuery(title)
  const url = new URL('https://commons.wikimedia.org/w/api.php')
  url.searchParams.set('action', 'query')
  url.searchParams.set('format', 'json')
  url.searchParams.set('generator', 'search')
  url.searchParams.set('gsrsearch', query)
  url.searchParams.set('gsrnamespace', '6')
  url.searchParams.set('gsrlimit', '8')
  url.searchParams.set('prop', 'imageinfo')
  url.searchParams.set('iiprop', 'url|mime')
  url.searchParams.set('iiurlwidth', '1200')
  const response = await fetchImpl(url.toString(), {
    signal: AbortSignal.timeout(4000),
    headers: { 'User-Agent': 'HeartsHigh/1.0 (course cover; educational)' },
  }).catch(() => null)
  if (!response?.ok) return null
  const body = await response.json().catch(() => null) as {
    query?: { pages?: Record<string, { title?: string; imageinfo?: { thumburl?: string; mime?: string }[] }> }
  } | null
  const pages = Object.values(body?.query?.pages || {})
  const hits: CoverHit[] = []
  const relevant: CoverHit[] = []
  for (const page of pages) {
    const name = page.title || ''
    if (/logo|icon|diagram|map|flag|coat of arms|signature|svg|pdf|president|greeting|portrait/i.test(name)) continue
    const info = page.imageinfo?.[0]
    if (!info?.thumburl || !info.mime) continue
    const hit = { url: info.thumburl, mime: info.mime }
    hits.push(hit)
    if (/\b(parent|child|children|family|mother|father|kid|school|home)\b/i.test(name)) relevant.push(hit)
  }
  const chosen = chooseCoverHit(relevant.length ? relevant : hits, seed)
  if (chosen) memory.set(seed, chosen)
  return chosen
}
