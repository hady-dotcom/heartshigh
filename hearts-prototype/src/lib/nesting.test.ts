import assert from 'node:assert/strict'
import test from 'node:test'
import { descend, ladderParentRef, parentIsOwn, talkChain } from './nesting'

test('a hors d\'oeuvre parents its appetiser, and that appetiser parents the full talk', () => {
  const chain = talkChain(42)
  assert.equal(chain.hors.parentId, 'appetiser:42')
  assert.equal(chain.hors.parentLevel, 'appetiser')
  assert.equal(chain.appetiser.parentId, 'talk:42')
  assert.equal(chain.appetiser.parentLevel, 'talk')
  assert.equal(chain.talk.parentId, null)
  assert.equal(descend('hors', 42)?.level, 'appetiser')
  assert.equal(descend('hors', 42)?.id, 'appetiser:42')
  assert.equal(descend('appetiser', 42)?.level, 'talk')
  assert.equal(descend('appetiser', 42)?.id, 'talk:42')
  assert.equal(descend('talk', 42), null)
  assert.notEqual(descend('hors', 42)?.level, 'talk')
})

test('a hors d\'oeuvre ladder row points at the appetiser that contains it, never the talk', () => {
  const appetisers = [
    { id: 7, kind: 'appetiser', start: 0, end: 40 },
    { id: 8, kind: 'appetiser', start: 80, end: 160 },
  ]
  assert.equal(ladderParentRef({ kind: 'hors', start: 10, end: 28 }, appetisers, 3), 'appetiser:7')
  assert.equal(ladderParentRef({ kind: 'hors', start: 90, end: 110 }, appetisers, 3), 'appetiser:8')
  assert.equal(ladderParentRef({ kind: 'appetiser', start: 0, end: 40 }, appetisers, 3), 'talk:3')
  assert.equal(ladderParentRef({ kind: 'hors', start: 1, end: 16 }, [], 3), 'appetiser:3')
  assert.equal(parentIsOwn('hors', 'appetiser:7'), true)
  assert.equal(parentIsOwn('hors', 'talk:3'), false)
  assert.equal(parentIsOwn('appetiser', 'talk:3'), true)
  assert.equal(parentIsOwn('appetiser', 'appetiser:7'), false)
})
