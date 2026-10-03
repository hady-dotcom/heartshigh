import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import type { Payload } from 'payload'
import { buildHadithIndex, matchHadith, type Hadith, type HadithIndex } from '@/lib/hadith-match'
import { COLLECTION_NAMES, harvestTranscript, type HarvestHit } from '@/lib/harvest'
import { getLlmClient, type LlmClient } from '@/lib/llm'
import { buildQuranIndex, type QuranCorpus, type QuranIndex } from '@/lib/quran-match'
import { TAFSIR_SOURCES, summaryLabel, summaryRequest, type TafsirText } from '@/lib/tafsir'

const root = process.cwd()
const QURAN_FILE = path.join(root, 'content/scripture/quran.json.gz')
const FALLBACK_FILE = path.join(root, 'content/scripture/fallback.json.gz')
const HADITH_API = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions'
const TAFSIR_API = 'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir'

export type Fallback = {
  sources: Record<string, string>
  tafsir: Record<string, Record<string, string>>
  hadith: Record<string, Hadith[]>
}

/** Tests and the e2e server never reach the network; they read the bundled fallback only. */
export function scriptureOffline() {
  return process.env.HEARTS_SCRIPTURE_OFFLINE === '1' || process.env.HEARTS_E2E === '1'
}

let quran: QuranIndex | null = null
export function quranIndex() {
  if (!quran) quran = buildQuranIndex(JSON.parse(gunzipSync(readFileSync(QURAN_FILE)).toString('utf8')) as QuranCorpus)
  return quran
}

let fallback: Fallback | null = null
export function scriptureFallback(): Fallback {
  if (!fallback) {
    fallback = existsSync(FALLBACK_FILE)
      ? (JSON.parse(gunzipSync(readFileSync(FALLBACK_FILE)).toString('utf8')) as Fallback)
      : { sources: {}, tafsir: {}, hadith: {} }
  }
  return fallback
}

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  if (scriptureOffline()) return null
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

async function cached<T>(payload: Payload, key: string): Promise<T | null> {
  const found = await payload.find({ collection: 'scripture-cache', overrideAccess: true, limit: 1, depth: 0, where: { key: { equals: key } } })
  return found.docs[0] ? ((found.docs[0] as { data?: T }).data ?? null) : null
}

async function remember(payload: Payload, key: string, kind: string, data: unknown) {
  try {
    const found = await payload.find({ collection: 'scripture-cache', overrideAccess: true, limit: 1, depth: 0, where: { key: { equals: key } } })
    if (found.docs[0]) await payload.update({ collection: 'scripture-cache', id: found.docs[0].id, overrideAccess: true, data: { data: data as Record<string, unknown> } })
    else await payload.create({ collection: 'scripture-cache', overrideAccess: true, data: { key, kind, data: data as Record<string, unknown> } })
  } catch {
    // A second request may have cached it first; the text is the same either way.
  }
}

type HadithEdition = { hadiths: { hadithnumber: number; arabicnumber?: number | string; text: string; grades?: { name: string; grade: string }[] }[] }

const hadithIndexes = new Map<string, HadithIndex>()
const diskDir = path.join(os.tmpdir(), 'hearts-scripture')

/**
 * A named collection, in English, for matching. Memory, then a disk copy, then the open hadith API.
 * Offline it is only the hadith bundled for the starter talks.
 */
export async function hadithIndex(slug: string): Promise<HadithIndex | null> {
  if (!COLLECTION_NAMES[slug]) return null
  const known = hadithIndexes.get(slug)
  if (known) return known
  const file = path.join(diskDir, `eng-${slug}.json`)
  let edition: HadithEdition | null = null
  if (!scriptureOffline() && existsSync(file)) edition = JSON.parse(readFileSync(file, 'utf8')) as HadithEdition
  if (!edition) {
    edition = await fetchJson<HadithEdition>(`${HADITH_API}/eng-${slug}.min.json`, 20000)
    if (edition) {
      try {
        mkdirSync(diskDir, { recursive: true })
        writeFileSync(file, JSON.stringify(edition))
      } catch {
        // Disk is only a convenience.
      }
    }
  }
  const hadiths: Hadith[] = edition
    ? edition.hadiths.map((row) => ({ number: row.hadithnumber, reference: referenceNumber(row.arabicnumber, row.hadithnumber), text: row.text, grades: row.grades || [] }))
    : scriptureFallback().hadith[slug] || []
  if (!hadiths.length) return null
  const index = buildHadithIndex(slug, hadiths)
  if (edition || scriptureOffline()) hadithIndexes.set(slug, index)
  return index
}

function referenceNumber(arabic: number | string | undefined, fallbackNumber: number) {
  const value = Number(arabic)
  return value ? String(Math.floor(value)) : String(fallbackNumber)
}

/** The Arabic of one hadith, from the bundle or the open API. Empty if neither has it. */
export async function hadithArabic(slug: string, number: number) {
  const bundled = (scriptureFallback().hadith[slug] || []).find((row) => row.number === number)
  if (bundled?.arabic) return bundled.arabic
  const row = await fetchJson<{ hadiths?: { text?: string }[] }>(`${HADITH_API}/ara-${slug}/${number}.json`)
  return row?.hadiths?.[0]?.text || ''
}

export type HarvestItem = HarvestHit & {
  collection?: string
  hadithNumber?: string
  hadithText?: string
  hadithArabic?: string
  grading?: string
}

function gradingOf(grades: { name: string; grade: string }[] | undefined) {
  return (grades || []).map((row) => `${row.grade} (${row.name})`).join('; ')
}

/**
 * Everything a talk's transcript gives the harvest: the verbatim quotes, each ayah matched against
 * the real Qur'an text, and a hadith only when the speaker named the collection and one hadith in
 * it matched clearly. Cached per transcript, so a talk is read once however many learners finish it.
 */
export async function talkHarvest(payload: Payload, lessonId: number, transcript: string): Promise<HarvestItem[]> {
  const key = `talk:${lessonId}:${hashOf(transcript)}`
  const known = await cached<HarvestItem[]>(payload, key)
  if (known) return known
  const hits = harvestTranscript(transcript, quranIndex())
  let complete = true
  const items: HarvestItem[] = []
  for (const hit of hits) {
    if (hit.kind !== 'hadith' || !hit.collections?.length) {
      items.push(hit)
      continue
    }
    let found: HarvestItem | null = null
    for (const slug of hit.collections) {
      const index = await hadithIndex(slug)
      if (!index) {
        complete = false
        continue
      }
      const match = matchHadith(index, `${hit.text} ${hit.context}`)
      if (!match) continue
      found = {
        ...hit,
        reference: `${COLLECTION_NAMES[slug]} ${match.hadith.reference || match.hadith.number}`,
        collection: slug,
        hadithNumber: String(match.hadith.number),
        hadithText: match.hadith.text,
        hadithArabic: await hadithArabic(slug, match.hadith.number),
        grading: gradingOf(match.hadith.grades),
      }
      break
    }
    const twin = found && items.find((item) => item.collection === found.collection && item.hadithNumber === found.hadithNumber && Math.abs(item.seconds - found.seconds) < 30)
    if (twin) continue
    items.push(found || hit)
  }
  if (complete) await remember(payload, key, 'talk', items)
  return items
}

/** Copy a talk's harvest into one learner's Garden. */
export async function giveHarvest(payload: Payload, userId: number, lessonId: number, transcript: string, portal?: number, extra: Record<string, unknown> = {}, window?: { start: number; end: number }) {
  let items = await talkHarvest(payload, lessonId, transcript)
  if (window) {
    if (!(window.end > window.start)) return 0
    const held = await payload.find({ collection: 'harvest-entries', overrideAccess: true, depth: 0, limit: 300, where: { and: [{ user: { equals: userId } }, { lesson: { equals: lessonId } }] } })
    const rows = held.docs as unknown as { text?: string; seconds?: number }[]
    items = items.filter((item) => item.seconds >= window.start - 1 && item.seconds <= window.end + 1)
      .filter((item) => !rows.some((row) => row.text === item.text || Math.abs(Number(row.seconds) - item.seconds) < 1.5))
  }
  for (const item of items) {
    await payload.create({
      collection: 'harvest-entries',
      overrideAccess: true,
      data: {
        user: userId,
        lesson: lessonId,
        portal,
        kind: item.kind,
        text: item.text,
        reference: item.reference,
        timestamp: item.timestamp,
        seconds: item.seconds,
        context: item.context,
        surah: item.surah,
        ayah: item.ayah,
        matchedBy: item.matchedBy,
        collection: item.collection,
        hadithNumber: item.hadithNumber,
        hadithText: item.hadithText,
        hadithArabic: item.hadithArabic,
        grading: item.grading,
        ...extra,
      } as never,
    })
  }
  return items.length
}

export function hashOf(text: string) {
  let hash = 5381
  for (let index = 0; index < text.length; index++) hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0
  return (hash >>> 0).toString(36)
}

/**
 * The tafsir of one ayah from each named source: the cache, then the bundle, then the open tafsir
 * API. A source that cannot be found is left out; nothing stands in for it.
 */
export async function tafsirFor(payload: Payload, surah: number, ayah: number): Promise<TafsirText[]> {
  const key = `tafsir:${surah}:${ayah}`
  const known = await cached<Record<string, string>>(payload, key)
  const bundled = scriptureFallback().tafsir[`${surah}:${ayah}`] || {}
  const texts: Record<string, string> = { ...bundled, ...(known || {}) }
  let fetched = false
  for (const source of TAFSIR_SOURCES) {
    if (texts[source.slug]) continue
    const row = await fetchJson<{ text?: string }>(`${TAFSIR_API}/${source.slug}/${surah}/${ayah}.json`)
    if (row?.text?.trim()) {
      texts[source.slug] = row.text.trim()
      fetched = true
    }
  }
  if (fetched) await remember(payload, key, 'tafsir', texts)
  return TAFSIR_SOURCES.filter((source) => texts[source.slug]).map((source) => ({ ...source, text: texts[source.slug] }))
}

export type TafsirSummary = { label: string; text: string; ai: boolean; sources: string[] }

/**
 * A short summary written only from the tafsir texts above, labelled with their names. With no AI
 * set up, it says so and shows al-Jalalayn, itself a short tafsir, in its own words.
 */
export async function tafsirSummary(payload: Payload, surah: number, ayah: number, client: LlmClient | null = getLlmClient()): Promise<TafsirSummary | null> {
  const texts = await tafsirFor(payload, surah, ayah)
  if (!texts.length) return null
  const key = `summary:${surah}:${ayah}:${texts.map((row) => row.slug).join(',')}`
  if (client) {
    const known = await cached<TafsirSummary>(payload, key)
    if (known) return known
    try {
      const request = summaryRequest(surah, ayah, texts)
      const reply = (await client.complete(request.llm)).trim()
      if (reply) {
        const summary = { label: summaryLabel(request.used), text: reply, ai: true, sources: request.used }
        await remember(payload, key, 'summary', summary)
        return summary
      }
    } catch {
      // Fall through to the source text.
    }
  }
  const short = texts.find((row) => row.slug === 'en-al-jalalayn') || texts.find((row) => row.language === 'English') || texts[0]
  return {
    label: `No AI summary is available here, so this is ${short.title} in its own words. It is itself a short tafsir.`,
    text: short.text,
    ai: false,
    sources: [short.title],
  }
}
