import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { harvestLine, harvestTranscript, lineAt, readableHarvest } from '../../src/lib/harvest'
import { endsDangling, finishedSentences, wordSlice } from '../../src/lib/sentences'
import { parseTranscript } from '../../src/lib/transcript'

const root = process.cwd()
const dir = path.join(root, 'content', 'transcripts')
const files = [
  ...readdirSync(dir).filter((name) => name.endsWith('.md')).map((name) => path.join(dir, name)),
  ...readdirSync(path.join(dir, 'starters')).filter((name) => name.endsWith('.vtt')).map((name) => path.join(dir, 'starters', name)),
].filter((file) => existsSync(file))

const flat = (text: string) => text.replace(/\s+/g, ' ').toLowerCase()
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Why a shown line is not a finished sentence of whole words, or null when it is. */
function fault(line: string, source: string) {
  if (!/[.?!]["”’')\]]*$/.test(line)) return 'does not end on a stop'
  if (/(…|\.\.)["”’')\]]*$/.test(line)) return 'trails off'
  if (endsDangling(line)) return 'ends on a hanging word'
  const tail = line.match(/([\p{L}\p{N}\p{M}'’%-]+)([.?!]+)["”’')\]]*$/u)
  if (!tail) return 'no last word'
  const [, word, stop] = tail
  if (!new RegExp(`(^|[^\\p{L}\\p{N}\\p{M}'’-])${escape(word.toLowerCase())} ?${escape(stop)}`, 'u').test(source)) return `"${word}${stop}" is not how the speaker's sentence ends`
  return null
}

test('wordSlice never cuts a word, finishedSentences never adds a stop', () => {
  assert.equal(wordSlice('we discussed this', 9), 'we')
  assert.equal(wordSlice('we discussed this', 12), 'we discussed')
  assert.equal(wordSlice('short', 10), 'short')
  assert.equal(finishedSentences("Allah says, O Moses, I'm going to give you exactly what you asked for. Everyth"), "Allah says, O Moses, I'm going to give you exactly what you asked for.")
  assert.equal(finishedSentences('all the things we discu'), '')
  assert.equal(finishedSentences('He paused. And then...'), 'He paused.')
  assert.equal(finishedSentences('As Dr. Umar says, be kind. And'), 'As Dr. Umar says, be kind.')
})

test('the reported lines: no "…we discu", no "…I\'m going to give"', () => {
  assert.equal(harvestLine('pondering over all the things we discu', 'you guys can spend some time pondering over all the things we discu'), null)
  const given = harvestLine("Allah says, O Moses, I'm going to give", "قَالَ قَدْ أُوتِيتَ سُؤْلَكَ يَا مُوسَى Allah says, O Moses, I'm going to give you exactly what you asked for. Everyth")
  // "…what you asked for." stops on a hanging word by the older rule, so the line is left out rather than cut short.
  assert.ok(given === null || /asked for\.$/.test(given), String(given))
  assert.equal(harvestLine("Allah says, O Moses, I'm going to give", "Allah says, O Moses, I'm going to give"), null)
  assert.equal(harvestLine('the light of the heavens', 'Allah tells us that He is the light of the heavens and the earth. And then the next'), 'Allah tells us that He is the light of the heavens and the earth.')
  assert.equal(harvestLine('this chapter is called good counsel', 'um this chapter is called good counsel . So we begin'), 'This chapter is called good counsel.')
})

test('over the real transcripts, every harvest line is whole sentences ending on a whole word', { timeout: 120_000 }, () => {
  assert.ok(files.length >= 20, `found ${files.length} transcripts`)
  const faults: string[] = []
  let shown = 0
  for (const file of files) {
    const raw = readFileSync(file, 'utf8')
    const source = flat(parseTranscript(raw).cues.map((cue) => cue.text).join(' '))
    const name = path.basename(file)
    const hits = harvestTranscript(raw)
    for (const row of readableHarvest(hits)) {
      shown += 1
      const why = fault(row.text, source)
      if (why) faults.push(`${name} @${row.timestamp} hit: ${why}: ${row.text}`)
    }
    // The same line and context lineAt gives for each cue (two cues either side), read from one parse.
    const cues = parseTranscript(raw).cues.map((cue) => ({ ...cue, text: cue.text.replace(/\s+/g, ' ').trim() }))
    cues.forEach((cue, index) => {
      const context = cues.slice(Math.max(0, index - 2), index + 3).map((row) => row.text).filter(Boolean).join(' ')
      const line = cue.text ? harvestLine(cue.text, context) : null
      if (!line) return
      shown += 1
      const why = fault(line, source)
      if (why) faults.push(`${name} @${cue.start.toFixed(1)}: ${why}: ${line}`)
    })
    const sample = cues[Math.floor(cues.length / 2)]
    const spoken = sample ? lineAt(raw, sample.start) : null
    if (spoken) assert.equal(spoken.context, cues.slice(Math.max(0, cues.indexOf(sample) - 2), cues.indexOf(sample) + 3).map((row) => row.text).filter(Boolean).join(' '))
  }
  assert.ok(shown > 200, `only ${shown} lines were readable`)
  assert.deepEqual(faults.slice(0, 15), [], `${faults.length} broken lines`)
})
