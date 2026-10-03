import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filmsForTalk, mixFeed } from '../../src/lib/films'
import type { FeedItem } from '../../src/server/learner'

function item(cutId: number, films: FeedItem['films'] = [], extra: Partial<FeedItem> = {}): FeedItem {
  return {
    id: `cut-${cutId}`,
    cutId,
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
    films,
    ...extra,
  }
}

const catalogue = {
  films: [
    { youtubeId: 'ECaTWkof57E', beat: 'land' as const, style: 'cinema' as const, src: '/typography/ECaTWkof57E/land.mp4', quote: 'know this name' },
    { youtubeId: 'ECaTWkof57E', beat: 'hook' as const, style: 'kinetic' as const, src: '/typography/ECaTWkof57E/hook.mp4', quote: 'never thought' },
    { youtubeId: 'NIR88RRpat4', beat: 'turn' as const, style: 'windows' as const, src: '/typography/NIR88RRpat4/turn.mp4', quote: 'dark' },
  ],
}

test('films attach to a talk in hook, turn, land order', () => {
  const films = filmsForTalk(catalogue, 'ECaTWkof57E')
  assert.deepEqual(films.map((film) => film.beat), ['hook', 'land'])
  assert.equal(filmsForTalk(catalogue, 'missing').length, 0)
})

test('a talk with no sheet row still plays the rendered face films, and the prophet films stay out', () => {
  const rendered = filmsForTalk({ films: [] }, 'ECaTWkof57E')
  assert.deepEqual(rendered.map((film) => film.style), ['kinetic', 'windows', 'conversation', 'cinema', 'unfold'])
  assert.equal(rendered[0].src, '/typography/ECaTWkof57E/kinetic.mp4')
  assert.equal(filmsForTalk({ films: [] }, 'TLCGBj4AlB0').length, 0)
})

test('a session alternates a face film and a scenic card, then a question, and a return visit swaps them', () => {
  const talk = item(1, filmsForTalk(catalogue, 'ECaTWkof57E'), { cardStyle: 'kinetic', cardScene: 'road' })
  const second = item(2, filmsForTalk(catalogue, 'NIR88RRpat4'), { cardStyle: 'windows', cardScene: 'mist' })
  const first = mixFeed([talk, second], 0)
  assert.deepEqual(first.map((row) => row.card || 'talk'), ['talk', 'film', 'question', 'talk', 'scene', 'question'])
  assert.equal(first[1].film?.src, '/typography/ECaTWkof57E/hook.mp4')
  assert.equal(first[2].prompt, 'What stays with you from this?')
  assert.equal(first[4].scene?.destination, 'clip')
  assert.equal(first[4].scene?.beats.length, 3)
  assert.notEqual(first[1].film?.style, first[4].scene?.style)
  const ids = new Set(first.map((row) => row.id))
  assert.equal(ids.size, first.length)

  const again = mixFeed([talk, second], 1)
  assert.deepEqual(again.map((row) => row.card || 'talk'), ['talk', 'scene', 'question', 'talk', 'film', 'question'])
  assert.equal(again[1].scene?.destination, 'clip')
  assert.notEqual(again[1].card, first[1].card)
  assert.notEqual(again[1].scene?.style, first[4].scene?.style)
})

test('a card keeps its own background, neighbours skip a shared tag, and learn more stays on the clip', () => {
  const talks = [1, 2, 3].map((cutId) => item(cutId, [], {
    cardStyle: 'kinetic',
    cardScene: cutId === 2 ? 'sky' : 'road',
    beats: [
      { beat: 'hook', quote: `Hook ${cutId}`, gold: 'Hook', audio: null },
      { beat: 'turn', quote: `Turn ${cutId}`, gold: 'Turn', audio: null },
      { beat: 'land', quote: `Land ${cutId}`, gold: 'Land', audio: null },
    ],
  }))
  const mixed = mixFeed(talks, 0).filter((row) => row.card === 'scene')
  assert.equal(mixed.length, 3)
  assert.equal(mixed[0].scene?.scene, '/slides/bg-cinema-road.jpg')
  assert.equal(mixed[0].scene?.destination, 'clip')
  assert.ok(mixed.every((row) => row.scene?.destination === 'clip'))
  assert.notEqual(mixed[0].scene?.scene, mixed[1].scene?.scene)
  assert.notEqual(mixed[1].scene?.scene, mixed[2].scene?.scene)
  const returned = mixFeed(talks, 2).filter((row) => row.card === 'scene')
  assert.ok(returned.every((row) => row.scene?.destination === 'clip'))
  assert.equal(returned[0].scene?.scene, mixed[0].scene?.scene)
})
