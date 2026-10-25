import assert from 'node:assert/strict'
import test from 'node:test'
import { earlierPlayableUnfinished, filmCanPlay, firstPlayableIndex } from './film-availability'

const row = (order: number, vimeoId: string) => ({ order, vimeoId, videoProvider: vimeoId ? 'vimeo' : null })

const films = [
  row(1, '496862893'),
  row(2, '496862550'),
  row(3, '496852675'),
  row(4, '496862832'),
  row(40, ''),
]

test('restricted and missing films cannot play, and the course opens on film 3', () => {
  assert.equal(filmCanPlay(films[0]), false)
  assert.equal(filmCanPlay(films[1]), false)
  assert.equal(filmCanPlay(films[2]), true)
  assert.equal(filmCanPlay(films[3]), false)
  assert.equal(filmCanPlay(films[4]), false)
  assert.equal(filmCanPlay({ youtubeId: 'abcdefghijk', videoProvider: 'youtube' }), true)
  assert.equal(firstPlayableIndex(films, filmCanPlay), 2)
  assert.equal(earlierPlayableUnfinished(films, 2, filmCanPlay, () => false), false)
  assert.equal(earlierPlayableUnfinished(films, 3, filmCanPlay, () => false), true)
})
