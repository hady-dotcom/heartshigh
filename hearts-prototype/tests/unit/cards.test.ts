import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { parseManifest } from '../../src/lib/typography/manifest'
import { landedGold, revealedQuote, spreadWords } from '../../src/lib/card-voice'
import { restoreSpokenTail } from '../../src/lib/typography/emphasis'
import { buildCards, readCardCatalogue, writeCardCatalogue } from '../../src/lib/cards'
import { backgroundByFile, sharesLook } from '../../src/lib/backgrounds'
import { pickScene } from '../../src/lib/scenes'

const root = path.resolve(import.meta.dirname, '../..')
const csv = readFileSync(path.resolve(root, '../remotion/manifest.example.csv'), 'utf8')

test('cards are one per talk, with the verbatim quote and the last gold landing', () => {
  const cards = buildCards(parseManifest(csv), root)
  assert.equal(cards.length, 2)
  assert.notEqual(cards[0].style, cards[1].style)
  assert.notEqual(cards[0].scene, cards[1].scene)
  const first = cards.find((card) => card.youtubeId === 'ECaTWkof57E')
  const second = cards.find((card) => card.youtubeId === 'NIR88RRpat4')
  assert.ok(first && second)
  assert.deepEqual(first.beats.map((beat) => beat.beat), ['hook', 'turn', 'land'])
  assert.equal(first.beats[0].quote, 'Has Allah brought you from one stage to the next stage to the places you never thought you would be?')
  assert.equal(first.beats[0].quote.includes('to to'), false)
  assert.equal(first.beats[1].quote, "But it's at that moment that you got to lock in and have true certainty that Allah's plan is real.")
  assert.equal(first.beats[2].quote, 'I told you that transitions are the time that you need to know this name Ar-Rabb.')
  assert.equal(first.background, 'jpg/A-01-lake-predawn-violet.jpg')
  assert.equal(second.background, 'jpg/A-02-fjord-dawn-rose.jpg')
  const firstStill = backgroundByFile(first.background)
  const secondStill = backgroundByFile(second.background)
  assert.ok(firstStill && secondStill)
  assert.equal(sharesLook(firstStill, secondStill), false)
  assert.equal(second.beats[0].quote, "What we're saying is that Allah ﷻ is the only source for clarity in your life.")
  assert.equal(second.beats[1].quote, "Without light, you walk in a room that's dark.")
  assert.equal(second.beats[2].quote, "Now Allah subhanahu wa ta'ala, He says, and many of us, we can relate to this verse.")
  assert.deepEqual(first.beats.map((beat) => beat.gold), ['never thought', "Allah's plan is real", 'Ar-Rabb'])
  assert.ok(first.beats[0].words && first.beats[0].words.length > 3)
  assert.equal(first.beats[0].words!.map((word) => word.text).join(' '), first.beats[0].quote)
  assert.ok(first.beats[0].words!.every((word, index, list) => index === 0 || word.at >= list[index - 1].at))
  const land = first.beats[2].words
  assert.ok(land && land.length > 3)
  assert.equal(land.map((word) => word.text).join(' '), first.beats[2].quote)
  assert.equal(land[land.length - 1].text, 'Ar-Rabb.')
  assert.ok(land[land.length - 1].at > land[land.length - 2].at)
  assert.ok(land[land.length - 1].at < 5.65, 'Ar-Rabb is spoken before the land audio ends')
  assert.equal(restoreSpokenTail('ECaTWkof57E', 'land', 'I told you that transitions are the time that you need to know this name.'), first.beats[2].quote)
  assert.equal(restoreSpokenTail('ECaTWkof57E', 'land', first.beats[2].quote), first.beats[2].quote)
  assert.equal(restoreSpokenTail('ECaTWkof57E', 'hook', first.beats[0].quote), first.beats[0].quote)
  assert.equal(restoreSpokenTail('NIR88RRpat4', 'land', second.beats[2].quote), second.beats[2].quote)
  assert.deepEqual(second.beats.map((beat) => beat.gold), ['clarity', 'dark', 'made for him light'])
  assert.match(second.beats[2].verse || '', /made for him light/)
  assert.match(second.beats[2].verse || '', /مَيْتًا/)
  assert.match(second.beats[2].quote, /this verse/)
  assert.ok(first.beats.every((beat) => beat.audio === `/typography/audio/${first.youtubeId}-${beat.beat}.m4a`))
  assert.ok(second.beats.every((beat) => beat.audio === `/typography/audio/${second.youtubeId}-${beat.beat}.m4a`))
})

test('a return visit steps the background, and a shared tag is not a neighbour', () => {
  const road = pickScene('road', 0, null)
  assert.equal(road.id, 'road')
  assert.equal(pickScene('road', 1, null).id, 'mist')
  const mist = pickScene('mist', 0, null)
  assert.equal(pickScene('sky', 0, mist).id, 'mountain')
})

test('words stay hidden until they are spoken, and gold lands with them', () => {
  const words = spreadWords('lock in and have certainty', 5)
  assert.equal(revealedQuote(words, 0), 'lock')
  assert.equal(revealedQuote(words, words[2].at - 0.01).includes('have'), false)
  assert.equal(landedGold('lock in and have', 'Allah\'s plan'), '')
  assert.equal(landedGold("true certainty that Allah's plan", "Allah's plan is real"), "Allah's plan")
  assert.equal(landedGold("Allah's plan is real", "Allah's plan is real"), "Allah's plan is real")
})

test('a beat with no audio file stays silent, and a later write keeps the other talks', () => {
  const empty = mkdtempSync(path.join(tmpdir(), 'hearts-cards-'))
  const cards = buildCards(parseManifest(csv), empty)
  assert.ok(cards.every((card) => card.beats.every((beat) => beat.audio === null)))
  const file = writeCardCatalogue([cards[0]], empty)
  writeCardCatalogue([cards[1]], empty)
  const held = readCardCatalogue(empty)
  assert.equal(held.cards.length, 2)
  assert.equal(file.endsWith('cards.json'), true)
})
