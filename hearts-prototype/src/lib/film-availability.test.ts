import assert from 'node:assert/strict'
import test from 'node:test'
import { earlierPlayableUnfinished, filmCanPlay, firstPlayableIndex } from './film-availability'

const row = (order: number, vimeoId: string) => ({ order, vimeoId, videoProvider: vimeoId ? 'vimeo' : null })

const films = [
  row(1, '1239173361'),
  row(2, '1239173362'),
  row(22, ''),
  row(23, '1239173387'),
  row(40, ''),
]

test('a film plays when it has a video id, and a film with no video is skipped', () => {
  assert.equal(filmCanPlay(films[0]), true)
  assert.equal(filmCanPlay(films[1]), true)
  assert.equal(filmCanPlay(films[2]), false)
  assert.equal(filmCanPlay(films[3]), true)
  assert.equal(filmCanPlay(films[4]), false)
  assert.equal(filmCanPlay({ youtubeId: 'abcdefghijk', videoProvider: 'youtube' }), true)
  assert.equal(filmCanPlay({ videoProvider: 'file' }), true)
  assert.equal(firstPlayableIndex(films, filmCanPlay), 0)
  assert.equal(earlierPlayableUnfinished(films, 3, filmCanPlay, (film) => film.order < 22), false)
  assert.equal(earlierPlayableUnfinished(films, 3, filmCanPlay, () => false), true)
})
