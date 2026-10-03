import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filmsForTalk, mixFeed } from '../../src/lib/films'
import type { FeedItem } from '../../src/server/learner'

function item(cutId: number, films: FeedItem['films'] = []): FeedItem {
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

test('the feed mixes a film, the line and a question after the talk, and a return visit changes the order', () => {
  const talk = item(1, filmsForTalk(catalogue, 'ECaTWkof57E'))
  const plain = item(2)
  const first = mixFeed([talk, plain], 0)
  assert.equal(first[0].id, 'cut-1')
  assert.equal(first[0].card, undefined)
  assert.deepEqual(first.slice(1, 4).map((row) => row.card), ['film', 'text', 'question'])
  assert.equal(first[1].film?.src, '/typography/ECaTWkof57E/hook.mp4')
  assert.equal(first[3].prompt, 'What stays with you from this?')
  assert.equal(first[4].id, 'cut-2')
  assert.equal(first.length, 5)
  const again = mixFeed([talk], 1)
  assert.deepEqual(again.slice(1).map((row) => row.card), ['text', 'film', 'question'])
  assert.notEqual(again[1].card, first[1].card)
  const ids = new Set(first.map((row) => row.id))
  assert.equal(ids.size, first.length)
})
