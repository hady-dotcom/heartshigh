import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { parseManifest } from '../../../remotion/src/manifest'
import { buildCards, readCardCatalogue, writeCardCatalogue } from '../../src/lib/cards'

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
  assert.equal(first.beats[0].quote, 'Has Allah brought you from one stage to the next stage to to the places you never thought you would be?')
  assert.deepEqual(first.beats.map((beat) => beat.gold), ['never thought', "Allah's plan is real", 'know this name'])
  assert.deepEqual(second.beats.map((beat) => beat.gold), ['clarity', 'dark', 'this verse'])
  assert.ok(first.beats.every((beat) => beat.audio === `/typography/audio/${first.youtubeId}-${beat.beat}.m4a`))
  assert.ok(second.beats.every((beat) => beat.audio === `/typography/audio/${second.youtubeId}-${beat.beat}.m4a`))
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
