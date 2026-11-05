import assert from 'node:assert/strict'
import { test } from 'node:test'
import { everyTileHasGlyph, hasGlyph } from '../../src/components/journey/glyphs'
import { PARENT_OPENING } from '../../src/lib/parent-opening'

test('a lone book glyph is not drawn on the parent opening chips', () => {
  assert.equal(hasGlyph('talk'), true)
  assert.equal(hasGlyph('watch'), false)
  assert.equal(hasGlyph('alone'), false)
  assert.equal(hasGlyph('bursts'), false)
  for (const scene of PARENT_OPENING) {
    assert.equal(everyTileHasGlyph(scene.options), false, scene.key)
  }
})

test('icons stay only when every chip in the row has one', () => {
  assert.equal(everyTileHasGlyph([{ key: 'treat' }, { key: 'tuck' }, { key: 'pause' }]), true)
  assert.equal(everyTileHasGlyph([{ key: 'treat' }, { key: 'missing' }]), false)
  assert.equal(everyTileHasGlyph([{ key: 'missing', crisis: true }, { key: 'treat' }]), true)
  assert.equal(everyTileHasGlyph([]), false)
})
