// Fetches what YouTube will give for each starter-map talk: the oEmbed title and channel, and captions through the
// transcript chain (yt-dlp, the watch page, then TRANSCRIPT_SERVICE_URL). Captions that arrive are saved to
// content/transcripts/starters/<id>.vtt; everything else is marked pending. Results go to content/starters-ingest.json,
// which the seed reads, so seeding never needs the network.
// Run: npx tsx scripts/ingest-starters.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { STARTERS } from '../src/seed/starters-data'
import { fetchYoutubeMeta, transcriptFor } from '../src/lib/youtube'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'content/transcripts/starters')
mkdirSync(dir, { recursive: true })

type Result = {
  youtubeId: string
  specTitle: string
  oembedTitle: string | null
  channel: string | null
  titleMatches: boolean | null
  transcript: 'ready' | 'pending'
  transcriptFile?: string
  tried: string[]
  reason?: string
}

const results: Result[] = []
for (const row of STARTERS) {
  const meta = await fetchYoutubeMeta(row.youtubeId).catch(() => undefined)
  const found = await transcriptFor(row.youtubeId).catch(() => ({ transcript: null, provider: null, tried: [] as string[] }))
  const result: Result = {
    youtubeId: row.youtubeId,
    specTitle: row.title,
    oembedTitle: meta?.title ?? null,
    channel: meta?.author ?? null,
    titleMatches: meta?.title ? meta.title === row.title : null,
    transcript: found.transcript ? 'ready' : 'pending',
    tried: found.tried,
  }
  if (found.transcript) {
    result.transcriptFile = `content/transcripts/starters/${row.youtubeId}.vtt`
    writeFileSync(path.join(root, result.transcriptFile), found.transcript)
  } else {
    result.reason = meta === null ? 'YouTube says the film is missing or private.' : `Captions refused from this machine (tried ${found.tried.join(', ') || 'nothing'}).`
  }
  results.push(result)
  console.log(`${row.youtubeId}  ${result.transcript.padEnd(7)}  ${result.titleMatches === false ? 'TITLE DIFFERS' : result.titleMatches ? 'title ok' : 'no oEmbed'}  ${row.title}`)
}
writeFileSync(path.join(root, 'content/starters-ingest.json'), `${JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2)}\n`)
