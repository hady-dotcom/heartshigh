import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { UI } from './copy'
import { EMPHASIS, phraseSpans } from './emphasis'
import { BREATH, cardAt, cardsOf, INTERTITLE, isVerbatim, leanOnStress, normaliseWords, PHRASE_HOLD, placeOnSpeech, scheduleFootage, scheduleTalk, snapBeat, sourceWindow, textNeverEarly, visibleIsPrefix, WINDOW_PAD, WORDS_PER_CARD, wordsVisibleAt, type CueWord } from './timing'

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

test('a beat opens and closes on the pause around a whole sentence', () => {
  // The cue that used to be the cut sits on the third word, in the middle of the sentence.
  const speechStart = 10
  const speechEnd = 11.6
  const edge = snapBeat(speechStart, speechEnd, 9.2, 12.4)
  assert.ok(edge.in <= speechStart)
  assert.ok(edge.out >= speechEnd)
  assert.ok(edge.in >= 9.2)
  assert.ok(edge.out <= 12.4)
  assert.ok(Math.abs(speechStart - edge.in - BREATH) < 1e-9)
  assert.ok(Math.abs(edge.out - speechEnd - BREATH) < 1e-9)
  assert.ok(edge.in < 10.8 && edge.out > 10.8)
  const tight = snapBeat(20, 23, 19.85, 23.12)
  assert.ok(tight.in >= 19.85)
  assert.ok(tight.out <= 23.12)
  assert.ok(tight.in < 20 && tight.out > 23)
  assert.ok(20 - tight.in < BREATH)
  assert.ok(tight.out - 23 < BREATH)
  const window = sourceWindow(edge)
  assert.equal(window.start, 0)
  assert.equal(window.end, Math.round((edge.out + WINDOW_PAD) * 100) / 100)
  const later = sourceWindow(snapBeat(100, 104, 99, 105))
  assert.equal(later.start, 89.7)
  assert.equal(later.end, 114.3)
})

test('a paused sentence waits for the next phrase, and the cut is only that sentence', () => {
  const runs = [{ start: 10, end: 10.6 }, { start: 12.1, end: 15 }]
  const placed = placeOnSpeech('I told you that transitions are the time that you need to know this name.', runs)
  assert.equal(placed[0].text, 'I')
  assert.ok(placed[0].talkAt < 10.6)
  assert.ok(placed[1].talkAt >= 12.1)
  assert.ok(placed.every((word, index) => index === 0 || word.talkAt > placed[index - 1].talkAt))
  const schedule = scheduleFootage([
    { beat: 'hook', text: 'Has Allah brought you here?', in: 1, out: 3, words: placeOnSpeech('Has Allah brought you here?', [{ start: 1.3, end: 2.7 }]) },
    { beat: 'land', text: placed.map((word) => word.text).join(' '), in: 9.7, out: 15.3, words: placed },
  ])
  assert.ok(Math.abs(schedule.beats[0].duration - (2 + PHRASE_HOLD)) < 1e-9)
  assert.ok(Math.abs(schedule.beats[1].duration - (5.6 + PHRASE_HOLD)) < 1e-9)
  assert.ok(textNeverEarly(schedule))
  const landWords = schedule.words.filter((row) => row.beat === 'land')
  for (const word of landWords) {
    assert.ok(Math.abs(word.showAt - (schedule.beats[1].videoAt + word.talkAt - 9.7)) < 1e-6)
    assert.ok(word.showAt >= schedule.beats[1].videoAt)
  }
  const landEnd = schedule.beats[1].videoAt + schedule.beats[1].duration
  assert.ok(landEnd - landWords[landWords.length - 1].showAt >= PHRASE_HOLD - 1e-6)
  const gapped = scheduleFootage(schedule.beats.map((beat) => ({ beat: beat.beat, text: beat.text, in: beat.talkAt, out: beat.talkAt + beat.duration, words: schedule.words.filter((word) => word.beat === beat.beat) })), INTERTITLE)
  assert.ok(gapped.beats[1].videoAt >= gapped.beats[0].videoAt + gapped.beats[0].duration + INTERTITLE - 1e-6)
  const stressed = leanOnStress([1, 1.4, 1.8], [{ from: 1, to: 1 }], [{ at: 1.55, level: 0.2 }, { at: 1.2, level: 0.04 }])
  assert.ok(stressed[1] > stressed[0])
  assert.ok(Math.abs(stressed[1] - 1.55) < 0.02)
})

test('the landed phrases are verbatim, and the film does not name its style', () => {
  const windows = JSON.parse(readFileSync(new URL('../talks/windows.json', import.meta.url), 'utf8')) as { talks: { id: string; beats: { beat: 'hook' | 'turn' | 'land'; text: string }[] }[] }
  for (const talk of windows.talks) {
    for (const beat of talk.beats) {
      const phrases = EMPHASIS[talk.id]?.[beat.beat] || []
      for (const phrase of phrases) assert.equal(isVerbatim(phrase, beat.text), true, `${talk.id} ${beat.beat} ${phrase}`)
      const words = beat.text.split(/\s+/).map((text) => ({ text }))
      const spans = phraseSpans(words, phrases)
      assert.equal(spans.length, phrases.length, `${talk.id} ${beat.beat}`)
    }
  }
  const film = readFileSync(new URL('./Film.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(film, /UI\.(kinetic|windows|conversation|cinema|unfold)/)
  assert.match(film, /UI\.learnMore/)
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
