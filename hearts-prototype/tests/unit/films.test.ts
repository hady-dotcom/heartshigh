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
    hook: 'The heart turns towards what it loves.',
    turn: 'But love asks to be proven.',
    land: 'So give it something to hold.',
    style: null,
    clause: null,
    films,
    parents: { hors: { id: `hors:${cutId}`, level: 'hors', parentId: `appetiser:${cutId}`, parentLevel: 'appetiser' }, appetiser: { id: `appetiser:${cutId}`, level: 'appetiser', parentId: `talk:${cutId}`, parentLevel: 'talk' } },
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

test('a session is talks only: no face film and no scenic typing card, on a return visit too', () => {
  const talk = item(1, filmsForTalk(catalogue, 'ECaTWkof57E'), { cardStyle: 'kinetic', cardScene: 'road' })
  const second = item(2, filmsForTalk(catalogue, 'NIR88RRpat4'), { cardStyle: 'windows', cardScene: 'mist' })
  const first = mixFeed([talk, second], 0)
  assert.deepEqual(first.map((row) => row.card || 'talk'), ['talk', 'talk'])
  assert.deepEqual(first.map((row) => row.cutId), [1, 2])
  assert.equal(first.some((row) => row.card === 'film' || row.card === 'scene' || row.card === 'question'), false)
  const again = mixFeed([talk, second], 1)
  assert.deepEqual(again.map((row) => row.id), first.map((row) => row.id))
})
