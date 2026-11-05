import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { CATALOGUE, backgroundSrc, parseCatalogue, pickBackground, sharesLook, type Background } from '../../src/lib/backgrounds'
import { mixFeed } from '../../src/lib/feed-mix'
import type { FeedItem } from '../../src/server/learner'

const root = path.resolve(import.meta.dirname, '../..')

test('the shipped catalogue matches the csv, and a walk never repeats a look', () => {
  const csv = readFileSync(path.join(root, 'content/backgrounds/catalogue-240.csv'), 'utf8')
  const parsed = parseCatalogue(csv)
  assert.equal(parsed.length, 240)
  assert.equal(CATALOGUE.length, 240)
  assert.deepEqual(CATALOGUE.map((row) => row.file), parsed.map((row) => row.file))
  assert.equal(CATALOGUE[0].brightness, 'dark')
  assert.equal(CATALOGUE.some((row) => row.brightness === 'light'), true)
  let previous: Background | null = null
  for (let index = 0; index < CATALOGUE.length; index++) {
    const next = pickBackground(CATALOGUE, index, previous)
    if (previous) {
      assert.equal(sharesLook(next, previous), false, `${next.file} beside ${previous.file}`)
      assert.notEqual(next.landscape, previous.landscape)
      assert.notEqual(next.palette, previous.palette)
      assert.notEqual(next.time, previous.time)
    }
    previous = next
  }
})

test('a neighbour skips a shared landscape, palette or time, and the same pick stays put', () => {
  const rows: Background[] = [
    { file: 'lake.jpg', slice: 'A', landscape: 'lake', time: 'dawn', season: 'spring', palette: 'gold', brightness: 'light', mood: 'warm' },
    { file: 'same-lake.jpg', slice: 'A', landscape: 'lake', time: 'noon', season: 'summer', palette: 'teal', brightness: 'mid', mood: 'fresh' },
    { file: 'same-dawn.jpg', slice: 'A', landscape: 'fjord', time: 'dawn', season: 'winter', palette: 'rose', brightness: 'mid', mood: 'hopeful' },
    { file: 'same-gold.jpg', slice: 'A', landscape: 'shore', time: 'dusk', season: 'autumn', palette: 'gold', brightness: 'mid', mood: 'tender' },
    { file: 'clear.jpg', slice: 'A', landscape: 'cliff', time: 'night', season: 'winter', palette: 'silver', brightness: 'dark', mood: 'still' },
  ]
  const lake = rows[0]
  assert.equal(pickBackground(rows, 'lake.jpg', null).file, 'lake.jpg')
  assert.equal(pickBackground(rows, 1, lake).file, 'clear.jpg')
  assert.equal(pickBackground(rows, 'same-dawn.jpg', lake).file, 'clear.jpg')
  assert.equal(pickBackground(rows, 'same-gold.jpg', lake).file, 'clear.jpg')
  assert.deepEqual(pickBackground(rows, 'clear.jpg', null), pickBackground(rows, 'clear.jpg', null))
  assert.equal(pickBackground(rows, 'clear.jpg', lake).file, 'clear.jpg')
  const stuck: Background[] = [
    { file: 'one.jpg', slice: 'A', landscape: 'lake', time: 'dawn', season: 'spring', palette: 'gold', brightness: 'mid', mood: 'warm' },
    { file: 'two.jpg', slice: 'A', landscape: 'fjord', time: 'noon', season: 'summer', palette: 'gold', brightness: 'dark', mood: 'still' },
  ]
  assert.equal(pickBackground(stuck, 'two.jpg', stuck[0]).file, 'two.jpg')
})

function talk(cutId: number, background: string): FeedItem {
  return {
    id: `cut-${cutId}`,
    cutId,
    parents: { hors: { id: `hors:${cutId}`, level: 'hors', parentId: `appetiser:${cutId}`, parentLevel: 'appetiser' }, appetiser: { id: `appetiser:${cutId}`, level: 'appetiser', parentId: `talk:${cutId}`, parentLevel: 'talk' } },
    lane: 'reflections',
    laneLabel: 'Reflections',
    speaker: 'Shaykh Mikaeel Smith',
    speakerSlug: 'mikaeel-smith',
    portrait: null,
    poster: null,
    youtubeId: cutId === 1 ? 'ECaTWkof57E' : 'NIR88RRpat4',
    courseId: 1,
    courseTitle: 'The Names',
    lessonId: cutId,
    hors: { start: 0, end: 8, quote: 'A line.' },
    appetiser: { start: 0, end: 20, quote: 'A longer line.' },
    hook: 'hook',
    turn: 'turn',
    land: 'land',
    style: null,
    clause: null,
    cardStyle: 'kinetic',
    cardScene: 'road',
    cardBackground: background,
    beats: [
      { beat: 'hook', quote: `Hook ${cutId}`, gold: 'Hook', audio: null },
      { beat: 'turn', quote: `Turn ${cutId}`, gold: 'Turn', audio: null },
      { beat: 'land', quote: `Land ${cutId}`, gold: 'Land', audio: null },
    ],
  }
}

test('a catalogue still can be addressed, and the learner mix does not turn it into a typing card', () => {
  const base = 'https://cdn.example'
  const talks = [
    talk(1, 'jpg/A-01-lake-predawn-violet.jpg'),
    talk(2, 'jpg/A-15-lake-golden-gold.jpg'),
  ]
  assert.equal(backgroundSrc('jpg/A-01-lake-predawn-violet.jpg', null), null)
  assert.equal(backgroundSrc('jpg/A-01-lake-predawn-violet.jpg', base), 'https://cdn.example/backgrounds/jpg/A-01-lake-predawn-violet.jpg')
  const mixed = mixFeed(talks, 0, base)
  assert.deepEqual(mixed.map((row) => row.cutId), [1, 2])
  assert.equal(mixed.some((row) => row.card === 'scene' || row.scene), false)
  const again = mixFeed(talks, 2, `${base}/`)
  assert.deepEqual(again.map((row) => row.id), mixed.map((row) => row.id))
})
