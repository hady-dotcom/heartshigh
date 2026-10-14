/**
 * Builds content/scripture/fallback.json.gz: the real tafsir for every ayah the bundled talks quote,
 * and the real hadith they quote from a named collection, so Harvest works offline and in tests.
 * Run it online: npx tsx scripts/scripture-fallback.ts
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { buildHadithIndex, matchHadith, type Hadith } from '../src/lib/hadith-match'
import { harvestTranscript } from '../src/lib/harvest'
import { TAFSIR_CREDIT, TAFSIR_SOURCES } from '../src/lib/tafsir'
import { quranIndex, type Fallback } from '../src/server/scripture'

const root = process.cwd()
const HADITH_API = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions'
const TAFSIR_API = 'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir'

async function json<T>(url: string): Promise<T | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(60000) })
      if (response.ok) return (await response.json()) as T
      if (response.status === 404) return null
    } catch {
      // try again
    }
  }
  throw new Error(`Could not fetch ${url}`)
}

function transcripts() {
  const out: string[] = []
  const starters = path.join(root, 'content/transcripts/starters')
  for (const file of readdirSync(starters)) if (file.endsWith('.vtt')) out.push(readFileSync(path.join(starters, file), 'utf8'))
  for (const file of readdirSync(path.join(root, 'content/transcripts'))) if (file.endsWith('.md')) out.push(readFileSync(path.join(root, 'content/transcripts', file), 'utf8'))
  const fixture = path.join(root, 'tests/fixtures/harvest-talk.vtt')
  if (existsSync(fixture)) out.push(readFileSync(fixture, 'utf8'))
  return out
}

async function main() {
  const index = quranIndex()
  const ayahs = new Set<string>()
  const wanted = new Map<string, string[]>()
  for (const raw of transcripts()) {
    for (const hit of harvestTranscript(raw, index)) {
      if (hit.surah && hit.ayah) ayahs.add(`${hit.surah}:${hit.ayah}`)
      for (const slug of hit.collections || []) wanted.set(slug, [...(wanted.get(slug) || []), `${hit.text} ${hit.context}`])
    }
  }
  const out: Fallback = {
    sources: {
      tafsir: TAFSIR_CREDIT,
      hadith: 'Hadith texts and grades from the open hadith API by fawazahmed0 (github.com/fawazahmed0/hadith-api, Unlicense).',
      built: new Date().toISOString().slice(0, 10),
    },
    tafsir: {},
    hadith: {},
  }
  for (const key of [...ayahs].sort()) {
    const [surah, ayah] = key.split(':')
    out.tafsir[key] = {}
    for (const source of TAFSIR_SOURCES) {
      const row = await json<{ text?: string }>(`${TAFSIR_API}/${source.slug}/${surah}/${ayah}.json`)
      if (row?.text?.trim()) out.tafsir[key][source.slug] = row.text.trim()
    }
    console.log(`tafsir ${key}: ${Object.keys(out.tafsir[key]).length} sources`)
  }
  for (const [slug, quotes] of wanted) {
    type Edition = { hadiths: { hadithnumber: number; arabicnumber?: number | string; text: string; grades?: { name: string; grade: string }[] }[] }
    const edition = await json<Edition>(`${HADITH_API}/eng-${slug}.min.json`)
    if (!edition) continue
    const hadiths: Hadith[] = edition.hadiths.map((row) => ({ number: row.hadithnumber, reference: Number(row.arabicnumber) ? String(Math.floor(Number(row.arabicnumber))) : String(row.hadithnumber), text: row.text, grades: row.grades || [] }))
    const hadithIndex = buildHadithIndex(slug, hadiths)
    const kept = new Map<number, Hadith>()
    for (const quote of quotes) {
      const match = matchHadith(hadithIndex, quote)
      if (match && !kept.has(match.hadith.number)) {
        const arabic = await json<{ hadiths?: { text?: string }[] }>(`${HADITH_API}/ara-${slug}/${match.hadith.number}.json`)
        kept.set(match.hadith.number, { ...match.hadith, arabic: arabic?.hadiths?.[0]?.text || '' })
      }
    }
    if (kept.size) out.hadith[slug] = [...kept.values()]
    console.log(`hadith ${slug}: ${kept.size} matched`)
  }
  const file = path.join(root, 'content/scripture/fallback.json.gz')
  const body = gzipSync(Buffer.from(JSON.stringify(out)), { level: 9 })
  writeFileSync(file, body)
  console.log(`Wrote ${path.relative(root, file)} (${Math.round(body.length / 1024)} KB, ${ayahs.size} ayahs)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
