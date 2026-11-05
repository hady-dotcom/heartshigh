import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { dualExtract } from './extractor'
import { parseTranscript } from './transcript'

const clauses = [
  { number: 3, fragment: 'WITH THE MESSENGER OF ALLAH', core: 'Sitting', teaching: 'Presence of the praised one.' },
  { number: 4, fragment: 'A MAN APPEARED', core: 'Sitting', teaching: 'Do not underrate the one who appears.' },
  { number: 13, fragment: 'TELL ME ABOUT ISLAM', core: 'Islam', teaching: 'Classified acts.' },
  { number: 22, fragment: 'BELIEVE IN ALLAH', core: 'Iman', teaching: 'Who Allah is.' },
  { number: 29, fragment: 'TELL ME ABOUT IHSAN', core: 'Ihsan', teaching: 'Lived excellence. Nafs is not the religion.' },
]

test('parses marked timestamps and webvtt', () => {
  const marked = parseTranscript('**[1:02]** One complete sentence about ease.\n\n**[1:20]** Another sentence lands here.')
  assert.equal(marked.cues.length, 2)
  assert.equal(marked.cues[0].start, 62)
  const vtt = parseTranscript(`WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nHello from the caption file, a full line.\n`)
  assert.equal(vtt.cues.length, 1)
  assert.equal(vtt.timed, true)
})

test('fahmy session 6 yields hook, turn and land cuts', () => {
  const raw = readFileSync(new URL('../../content/transcripts/fahmy-session6.md', import.meta.url), 'utf8')
  const result = dualExtract(raw, clauses)
  assert.ok(result.cuts.length >= 8, `expected at least 8 cuts, got ${result.cuts.length}`)
  for (const cut of result.cuts) {
    assert.ok(cut.hook.length > 20)
    assert.ok(cut.turn.length > 10)
    assert.ok(cut.land.length > 10)
    assert.ok(cut.timestamp)
    assert.ok(cut.fullContext.includes(cut.land.slice(0, 24)) || cut.fullContext.length > 40)
    assert.ok(['strong', 'medium', 'stretch', 'no_clean_hang'].includes(cut.hangStrength))
    assert.ok(['dual', 'allure-only', 'curriculum-extra'].includes(cut.kind))
  }
  const blob = result.cuts.map((cut) => `${cut.hook} ${cut.land}`).join('\n')
  assert.match(blob, /semi-truck/i)
  assert.match(blob, /ease/i)
  assert.ok(result.ladder.some((item) => item.kind === 'hors'))
  assert.ok(result.ladder.some((item) => item.kind === 'appetiser'))
  const hors = result.ladder.find((item) => item.kind === 'hors')!
  assert.ok(hors.end - hors.start >= 15 && hors.end - hors.start <= 21)
})

test('a transcript with no timestamps still cuts, and says confidence is low', () => {
  const raw = Array.from({ length: 12 }, (_, index) => {
    return `This is sentence number ${index} about prayer and the heart, and it is not a fragment. Allah says the heart finds rest when we remember.`
  }).join(' ')
  const result = dualExtract(raw, clauses)
  assert.ok(result.cuts.length >= 1)
  assert.equal(result.cuts[0].quoteConfidence, 'low')
})

test('empty transcript does not invent a cut', () => {
  const result = dualExtract('   ', clauses)
  assert.equal(result.cuts.length, 0)
})
