import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clipWords, isAside, wholeSentences } from '../../src/lib/sentences'

test('a beat never ends on the start of the next sentence, and never starts on the end of the last', () => {
  assert.equal(wholeSentences('He will be raised on day of Judgment. The'), 'He will be raised on day of Judgment.')
  assert.equal(wholeSentences('Judgment. The Prophet said be kind to your parents every single day'), 'The Prophet said be kind to your parents every single day.')
  assert.equal(wholeSentences('of mercy. Allah is the Most Merciful. And'), 'Allah is the Most Merciful.')
  assert.equal(wholeSentences('The'), '')
  assert.equal(wholeSentences('…and'), '')
})

test('a line starts with a capital and ends on a stop', () => {
  assert.equal(wholeSentences('the heart is a vessel for light'), 'The heart is a vessel for light.')
  assert.equal(wholeSentences('“be kind to one another,” he said,'), '“Be kind to one another,” he said.')
  assert.equal(wholeSentences('Is that not enough?'), 'Is that not enough?')
})

test('maxChars keeps whole sentences that fit, and always at least one', () => {
  const text = 'Gratitude is a door. It opens onto more of what you are grateful for. Patience is its twin and walks beside it.'
  assert.equal(wholeSentences(text, { maxChars: 70 }), 'Gratitude is a door. It opens onto more of what you are grateful for.')
  assert.equal(wholeSentences(text, { maxChars: 10 }), 'Gratitude is a door.')
})

test('asides about the video are recognised', () => {
  for (const line of ['check the description for the full dua', "I'm paraphrasing here", 'please subscribe', '[Music]']) assert.ok(isAside(line), line)
  assert.ok(!isAside('The Prophet said the strong one controls himself when angry.'))
})

test('clipWords cuts on a word and marks the cut', () => {
  const prompt = 'When you feel that the light is entering your heart, what changes in how you pray?'
  const clipped = clipWords(prompt, 60)
  assert.ok(clipped.endsWith('…'))
  assert.ok(clipped.length <= 61)
  assert.ok(prompt.startsWith(clipped.slice(0, -1)))
  assert.match(prompt.slice(clipped.length - 1), /^[\s,;:.]/, 'the cut falls between words')
  assert.equal(clipWords('Short enough.', 60), 'Short enough.')
})

test('harvest lines: whole sentences from their own context, asides dropped, caption tails cut', async () => {
  const { harvestLine } = await import('../../src/lib/harvest')
  assert.equal(harvestLine('check the description for the full dua that I mentioned'), null)
  assert.equal(harvestLine("I'm paraphrasing here but the meaning is the same"), null)
  assert.equal(harvestLine('Judgment. The Prophet said the strong one is the one who controls himself'), 'The Prophet said the strong one is the one who controls himself.')
  const context = 'We sat with him for years. and he would say the heart is a vessel for light and it fills when you remember Allah. Then he would smile.'
  assert.equal(harvestLine('the heart is a vessel for light and it fills', context), 'And he would say the heart is a vessel for light and it fills when you remember Allah.')
  assert.equal(harvestLine('Allah is with the patient.', ''), 'Allah is with the patient.')
  assert.equal(harvestLine('so', 'so'), null)
})

test('a scenic card for a talk without a voiced card gets whole-sentence beats, and a fragment beat is dropped', async () => {
  const { mixFeed } = await import('../../src/lib/feed-mix')
  const item = {
    id: 'cut-9', cutId: 9, lane: 'reflections', laneLabel: 'Reflections', speaker: 'A Speaker', speakerSlug: 'a-speaker', portrait: null, poster: null,
    youtubeId: 'abc', courseId: 1, courseTitle: 'Imported', lessonId: 9, hors: { start: 0, end: 8, quote: 'A line.' }, appetiser: { start: 0, end: 20, quote: 'A longer line.' },
    hook: 'and they will all stand before Him on the day of Judgment. The',
    turn: 'Judgment. The Prophet said the strong one holds himself back when he is angry. And',
    land: 'The',
    style: null, clause: null, cardStyle: 'cinema', cardScene: 'road', cardBackground: null,
  }
  const scene = mixFeed([item as never], 1).find((row) => row.card === 'scene')
  assert.deepEqual(scene?.scene?.beats.map((beat) => [beat.beat, beat.quote, beat.audio]), [
    ['hook', 'And they will all stand before Him on the day of Judgment.', null],
    ['turn', 'The Prophet said the strong one holds himself back when he is angry.', null],
  ])
})
