import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lineWords, linesOnScreen, phraseLines, withoutStutters } from './lines'
import { LEARN_MORE_SECONDS } from './timing'

test('a repeated word is shown once, at the later time', () => {
  const kept = withoutStutters([
    { text: 'to', showAt: 3.2 },
    { text: 'to', showAt: 3.45 },
    { text: 'the', showAt: 3.7 },
  ])
  assert.deepEqual(kept.map((word) => word.text), ['to', 'the'])
  assert.equal(kept[0].showAt, 3.45)
  assert.equal(withoutStutters([{ text: 'Allah' }, { text: 'ﷻ' }, { text: 'is' }]).length, 3)
})

test('a lone function word waits until the rest of its phrase is spoken', () => {
  const words = [
    { text: 'I', showAt: 0.3 },
    { text: 'told', showAt: 2.4 },
    { text: 'you', showAt: 2.7 },
  ]
  const [line] = phraseLines(words, [])
  assert.equal(lineWords(line, 0.5).length, 0)
  assert.deepEqual(lineWords(line, 2.4).map((word) => word.text), ['I', 'told'])
  assert.ok(lineWords(line, 2.4).every((word, index) => index === 0 || word.showAt >= words[0].showAt))
})

test('an earlier gold landing leaves when the next one arrives', () => {
  const words = [
    { text: 'the', showAt: 1 },
    { text: 'only', showAt: 2 },
    { text: 'source', showAt: 2.3 },
    { text: 'for', showAt: 2.8 },
    { text: 'clarity', showAt: 3.2 },
  ]
  const lines = phraseLines(words, [
    { from: 1, to: 2, phrase: 'only source' },
    { from: 4, to: 4, phrase: 'clarity' },
  ])
  const before = linesOnScreen(lines, 2.4).filter((line) => line.gold)
  assert.deepEqual(before.map((line) => line.phrase), ['only source'])
  const after = linesOnScreen(lines, 3.3).filter((line) => line.gold)
  assert.deepEqual(after.map((line) => line.phrase), ['clarity'])
  assert.equal(after.some((line) => line.words.some((word) => word.text === 'only')), false)
})

test('the learn more card holds for a second and a half', () => {
  assert.equal(LEARN_MORE_SECONDS, 1.5)
})
