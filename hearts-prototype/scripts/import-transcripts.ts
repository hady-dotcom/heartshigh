// Turns YouTube caption files (<id>.vtt, rolling auto captions or plain cues) into the clean line-by-line WebVTT the
// seed ships in content/transcripts/starters, and records each talk's length from its last caption.
// Usage: npx tsx scripts/import-transcripts.ts [folder with <id>.vtt files]
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanVtt, lastSecond, linesFromWords, wordTimeline } from '../src/lib/tiers'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = process.argv[2] || '/tmp/tx/transcripts'
const target = path.join(root, 'content/transcripts/starters')
mkdirSync(target, { recursive: true })

const index: Record<string, { seconds: number; lines: number; words: number }> = {}
for (const file of readdirSync(source).filter((name) => /^[\w-]{11}\.vtt$/.test(name)).sort()) {
  const id = file.slice(0, 11)
  const raw = readFileSync(path.join(source, file), 'utf8')
  const words = wordTimeline(raw)
  const lines = linesFromWords(words)
  writeFileSync(path.join(target, `${id}.vtt`), cleanVtt(raw, `English captions for https://www.youtube.com/watch?v=${id}, from YouTube, repeats removed.`))
  index[id] = { seconds: lastSecond(lines), lines: lines.length, words: words.length }
}
writeFileSync(path.join(target, 'index.json'), `${JSON.stringify(index, null, 2)}\n`)
console.log(`Imported ${Object.keys(index).length} transcripts into ${path.relative(root, target)}`)
