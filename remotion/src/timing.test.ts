import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { UI } from './copy'
import { cardAt, cardsOf, isVerbatim, normaliseWords, scheduleTalk, textNeverEarly, visibleIsPrefix, WORDS_PER_CARD, wordsVisibleAt, type CueWord } from './timing'

const cues: CueWord[] = [
  { text: 'Patience', talkAt: 10 },
  { text: 'is', talkAt: 10.3 },
  { text: 'a', talkAt: 10.5 },
  { text: 'light', talkAt: 10.8 },
  { text: 'in', talkAt: 11.1 },
  { text: 'the', talkAt: 11.3 },
  { text: 'heart.', talkAt: 11.7 },
  { text: 'But', talkAt: 20 },
  { text: 'the', talkAt: 20.25 },
  { text: 'turn', talkAt: 20.55 },
  { text: 'is', talkAt: 20.8 },
  { text: 'sharper', talkAt: 21.1 },
  { text: 'than', talkAt: 21.45 },
  { text: 'that.', talkAt: 21.8 },
  { text: 'Land', talkAt: 30 },
  { text: 'on', talkAt: 30.3 },
  { text: 'what', talkAt: 30.55 },
  { text: 'was', talkAt: 30.8 },
  { text: 'said.', talkAt: 31.15 },
]

const transcript = cues.map((cue) => cue.text).join(' ')

function scheduled() {
  return scheduleTalk({
    hook: 'Patience is a light in the heart.',
    turn: 'But the turn is sharper than that.',
    land: 'Land on what was said.',
    hookAt: 10,
    turnAt: 20,
    landAt: 30,
    cues,
  })
}

test('every on-screen word is verbatim from the transcript', () => {
  const talk = scheduled()
  for (const beat of ['hook', 'turn', 'land'] as const) {
    const line = talk.words.filter((word) => word.beat === beat).map((word) => word.text).join(' ')
    assert.equal(normaliseWords(line), normaliseWords(talk.beats.find((row) => row.beat === beat)!.text))
    assert.ok(isVerbatim(line, transcript), line)
  }
  assert.ok(isVerbatim(talk.words.map((word) => word.text).join(' '), transcript))
})

test('no word appears before its transcript cue', () => {
  const talk = scheduled()
  assert.ok(textNeverEarly(talk))
  for (const word of talk.words) {
    const early = wordsVisibleAt(talk.words, word.showAt - 0.05)
    assert.ok(!early.includes(word), `${word.text} at ${word.showAt}`)
    assert.ok(visibleIsPrefix(talk.words, word.showAt))
  }
  const beforeLead = wordsVisibleAt(talk.words, 0.1)
  assert.equal(beforeLead.length, 0)
})

test('a later beat stays off screen until its own cue', () => {
  const talk = scheduled()
  const turn = talk.beats.find((beat) => beat.beat === 'turn')!
  const justBefore = wordsVisibleAt(talk.words, turn.videoAt - 0.05)
  assert.ok(justBefore.every((word) => word.beat === 'hook'))
  const atTurn = wordsVisibleAt(talk.words, turn.videoAt + 0.02)
  assert.ok(atTurn.some((word) => word.beat === 'turn'))
  assert.ok(atTurn.every((word) => word.beat !== 'land'))
})

test('a long beat turns the page at 22 words instead of shrinking', () => {
  const words = Array.from({ length: 39 }, (_, index) => ({ text: `word${index}`, talkAt: 30 + index * 0.3 }))
  const talk = scheduleTalk({
    hook: 'Patience is a light in the heart.',
    turn: 'But the turn is sharper than that.',
    land: words.map((word) => word.text).join(' '),
    hookAt: 10,
    turnAt: 20,
    landAt: 30,
    cues: [
      ...cues.filter((cue) => cue.talkAt < 30),
      ...words,
    ],
  })
  const land = talk.words.filter((word) => word.beat === 'land')
  const cards = cardsOf(land)
  assert.equal(cards.length, 2)
  assert.ok(cards.every((card) => card.length <= WORDS_PER_CARD))
  const first = cardAt(land, land[0].showAt)
  assert.equal(first.length, WORDS_PER_CARD)
  assert.equal(first[0].text, 'word0')
  const secondCue = land[WORDS_PER_CARD]
  const before = cardAt(land, secondCue.showAt - 0.05)
  assert.ok(before.every((word) => word.showAt < secondCue.showAt))
  assert.ok(!before.some((word) => word.text === secondCue.text))
  const onPage = cardAt(land, secondCue.showAt)
  assert.equal(onPage[0].text, secondCue.text)
  assert.ok(onPage.length <= WORDS_PER_CARD)
  const film = readFileSync(new URL('./Film.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(film, /fitted\(/)
  assert.doesNotMatch(film, /size=\{(?:[1-2]?\d|3[0-3])\}/)
})

test('British English labels stay on the allowlist', () => {
  assert.equal(UI.learnMore, 'Learn more')
  assert.equal(UI.fullTalk, 'The full talk')
  assert.deepEqual([UI.hook, UI.turn, UI.land], ['Hook', 'Turn', 'Land'])
  assert.doesNotMatch(Object.values(UI).join(' '), /\b(color|favorite|center|customize)\b/i)
  const film = readFileSync(new URL('./Film.tsx', import.meta.url), 'utf8')
  assert.match(film, /UI\.learnMore/)
  assert.doesNotMatch(film, /Learn More/)
})
