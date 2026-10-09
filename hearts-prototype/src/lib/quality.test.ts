import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { dualExtract } from './extractor'
import { formatTimestamp, isVerbatim, parseTranscript } from './transcript'

const files = ['fahmy-session6.md', 'mikaeel-ar-rabb.md', 'mikaeel-al-nur.md']
const read = (name: string) => readFileSync(new URL(`../../content/transcripts/${name}`, import.meta.url), 'utf8')

for (const name of files) {
  test(`${name}: every cut quotes the transcript word for word, at a time the transcript really has`, () => {
    const raw = read(name)
    const { cues } = parseTranscript(raw)
    const starts = new Set(cues.map((cue) => formatTimestamp(cue.start)))
    const result = dualExtract(raw)
    assert.ok(result.cuts.length >= 3, `${name}: expected at least 3 cuts, got ${result.cuts.length}`)
    for (const cut of result.cuts) {
      for (const part of [cut.hook, cut.turn, cut.land, cut.verbatimQuote]) {
        assert.ok(part.trim().length > 0, `${name} ${cut.timestamp}: empty hook, turn or land`)
        assert.ok(isVerbatim(part, raw), `${name} ${cut.timestamp}: not verbatim: "${part.slice(0, 80)}"`)
      }
      assert.ok(starts.has(cut.timestamp), `${name}: ${cut.timestamp} is not a cue start in the transcript`)
      assert.ok(cut.end > cut.start, `${name} ${cut.timestamp}: end must come after start`)
      assert.match(cut.hook, /[.?!…"”']$/, `${name} ${cut.timestamp}: hook should end on a full sentence`)
      assert.match(cut.land, /[.?!…"”']$/, `${name} ${cut.timestamp}: land should end on a full sentence`)
    }
    const ids = new Set(result.cuts.map((cut) => cut.id))
    assert.equal(ids.size, result.cuts.length, 'cut ids are unique')
  })
}

test('estimated timestamps are marked as low confidence', () => {
  const result = dualExtract(read('mikaeel-ar-rabb.md'))
  assert.ok(result.cuts.every((cut) => cut.quoteConfidence !== 'high'))
})

test('a reworded line is not accepted as verbatim', () => {
  const raw = read('fahmy-session6.md')
  assert.equal(isVerbatim('This sentence was never said by anybody in the talk at all.', raw), false)
})
