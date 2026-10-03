import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { parseManifest } from '../../../remotion/src/manifest'
import { landedGold, revealedQuote, spreadWords } from '../../src/lib/card-voice'
import { buildCards, readCardCatalogue, writeCardCatalogue } from '../../src/lib/cards'
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
  assert.deepEqual(first.beats.map((beat) => beat.gold), ['never thought', "Allah's plan is real", 'know this name'])
  assert.ok(first.beats[0].words && first.beats[0].words.length > 3)
  assert.equal(first.beats[0].words!.map((word) => word.text).join(' '), first.beats[0].quote)
  assert.ok(first.beats[0].words!.every((word, index, list) => index === 0 || word.at >= list[index - 1].at))
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
