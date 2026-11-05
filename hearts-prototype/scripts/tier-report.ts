// Prints the machine draft for every talk with a transcript: the hors d'oeuvre, the appetiser and its hook, turn and
// land, so a person can read them side by side. Usage: npx tsx scripts/tier-report.ts [youtube id]
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { draftTiers } from '../src/lib/tiers'
import { formatTimestamp } from '../src/lib/transcript'
import { STARTERS } from '../src/seed/starters-data'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'content/transcripts/starters')
const only = process.argv[2]

export function talkSources() {
  const out: { id: string; title: string; raw: string; seconds: number | null }[] = []
  for (const row of STARTERS) {
    const file = path.join(dir, `${row.youtubeId}.vtt`)
    const marked = row.youtubeId === 'NIR88RRpat4' ? path.join(root, 'content/transcripts/mikaeel-al-nur.md') : null
    const raw = existsSync(file) ? readFileSync(file, 'utf8') : marked && existsSync(marked) ? readFileSync(marked, 'utf8') : null
    if (raw) out.push({ id: row.youtubeId, title: row.title, raw, seconds: row.lengthSec })
  }
  return out
}

const clock = (value: number) => `${formatTimestamp(value)} (${value.toFixed(1)})`
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void readdirSync
  for (const talk of talkSources()) {
    if (only && talk.id !== only) continue
    const draft = draftTiers(talk.raw, talk.seconds)
    console.log(`\n## ${talk.id} ${talk.title}`)
    if (!draft) {
      console.log('  no draft')
      continue
    }
    console.log(`  hors ${clock(draft.hors.start)} to ${clock(draft.hors.end)} = ${(draft.hors.end - draft.hors.start).toFixed(1)}s`)
    console.log(`    "${draft.hors.quote}"`)
    console.log(`  appetiser ${clock(draft.appetiser.start)} to ${clock(draft.appetiser.end)} = ${(draft.appetiser.end - draft.appetiser.start).toFixed(1)}s`)
    console.log(`    hook @${draft.hookAt}: ${draft.hook}`)
    console.log(`    turn @${draft.turnAt}: ${draft.turn}`)
    console.log(`    land @${draft.landAt}: ${draft.land}`)
    for (const popup of draft.popups) console.log(`    pop-up @${popup.second}: ${popup.quote}`)
  }
}
