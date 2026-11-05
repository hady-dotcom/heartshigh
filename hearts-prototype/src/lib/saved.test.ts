import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { cutIdFromSaved, parseIdList, savedHref } from './saved'

describe('saved clips', () => {
  it('reads a stored id list and opens that clip in the feed', () => {
    assert.deepEqual(parseIdList('["cut-12","cut-9"]'), ['cut-12', 'cut-9'])
    assert.deepEqual(parseIdList('not-json'), [])
    assert.equal(cutIdFromSaved('cut-41'), 41)
    assert.equal(savedHref('/p/hearts-demo', 'cut-41'), '/p/hearts-demo/feed?clip=41')
  })
})
