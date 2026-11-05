// Writes remotion/talks/<id>.json for the seeded talks (or the ids passed on the command line).
// Hook, turn and land come from the same line-mode draft the app seeds. Word times come from the captions.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LANES } from '../src/lib/opening-data'
import { draftTiers, wordsOf } from '../src/lib/tiers'
import { STARTERS } from '../src/seed/starters-data'
import { scheduleTalk } from '../src/lib/typography/timing'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const hearts = path.join(root, 'hearts-prototype')
const outDir = path.join(root, 'remotion', 'talks')

const SEEDED = ['TLCGBj4AlB0', 'ECaTWkof57E', 'NIR88RRpat4']

const PRESENT: Record<string, { speaker: string; courseTitle: string; title: string; lane: string }> = {
  TLCGBj4AlB0: { speaker: 'Shaykh Yasir Fahmy', courseTitle: 'How to Live Like the Prophet', title: 'How to Live Like the Prophet', lane: 'Reflections' },
  ECaTWkof57E: { speaker: 'Shaykh Mikaeel Smith', courseTitle: 'The Names', title: 'Ar-Rabb', lane: 'Reflections' },
  NIR88RRpat4: { speaker: 'Shaykh Mikaeel Smith', courseTitle: 'The Names', title: 'Al-Nur', lane: 'Talking to Allah' },
}

const laneTitle = (key: string) => LANES.find((lane) => lane.key === key)?.title || 'Reflections'

function transcriptFor(id: string) {
  const vtt = path.join(hearts, 'content', 'transcripts', 'starters', `${id}.vtt`)
  if (existsSync(vtt)) return readFileSync(vtt, 'utf8')
  if (id === 'NIR88RRpat4') return readFileSync(path.join(hearts, 'content', 'transcripts', 'mikaeel-al-nur.md'), 'utf8')
  throw new Error(`No transcript for ${id}`)
}

function exportTalk(id: string) {
  const row = STARTERS.find((starter) => starter.youtubeId === id)
  const raw = transcriptFor(id)
  const draft = draftTiers(raw, row?.lengthSec)
  if (!draft) throw new Error(`${id} has no hook, turn and land`)
  const cues = wordsOf(raw).map((word) => ({ text: word.text, talkAt: word.at }))
  const schedule = scheduleTalk({
    hook: draft.hook,
    turn: draft.turn,
    land: draft.land,
    hookAt: draft.hookAt,
    turnAt: draft.turnAt,
    landAt: draft.landAt,
    cues,
  })
  const known = PRESENT[id]
  const talk = {
    id,
    title: known?.title || row?.title || id,
    speaker: known?.speaker || row?.speaker || 'The speaker',
    courseTitle: known?.courseTitle || row?.series || 'The full talk',
    lane: known?.lane || laneTitle(row?.lane || ''),
    hook: draft.hook,
    turn: draft.turn,
    land: draft.land,
    hookAt: draft.hookAt,
    turnAt: draft.turnAt,
    landAt: draft.landAt,
    audio: null as string | null,
    ...schedule,
  }
  mkdirSync(outDir, { recursive: true })
  const dest = path.join(outDir, `${id}.json`)
  writeFileSync(dest, JSON.stringify(talk))
  console.log(`${id}: ${talk.words.length} words, ${talk.spokenSeconds.toFixed(1)}s spoken, cinema ${talk.cinemaSeconds.toFixed(1)}s`)
  console.log(`  hook @${draft.hookAt.toFixed(1)}: ${draft.hook}`)
  console.log(`  turn @${draft.turnAt.toFixed(1)}: ${draft.turn}`)
  console.log(`  land @${draft.landAt.toFixed(1)}: ${draft.land}`)
  return dest
}

const ids = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
for (const id of ids.length ? ids : SEEDED) exportTalk(id)
