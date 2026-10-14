import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cleanPortalScenes, portalSceneFromForm } from './portal-scenes'

test('a portal can add a non-Islamic opening question on top of the starter set', () => {
  const result = portalSceneFromForm({
    caption: 'A buyer asks for a second viewing this evening.',
    subline: 'Go with your first thought.',
    labels: ['Stay late and show them.', 'Offer tomorrow instead.', 'Ask a colleague to cover.'],
    existing: [],
  })
  assert.equal(result.error, undefined)
  assert.equal(result.scenes.length, 1)
  assert.equal(result.scenes[0].options.length, 3)
  assert.equal(result.scenes[0].options[0].nudges.length, 0)
  assert.match(result.scenes[0].caption, /buyer/)
})

test('portal questions refuse empty or kill-list copy', () => {
  const empty = portalSceneFromForm({ caption: '', labels: ['One'], existing: [] })
  assert.ok(empty.error || empty.scenes.length === 0)
  const dirty = cleanPortalScenes([{ caption: 'Unlock the right answer', options: [{ label: 'Yes' }, { label: 'No' }] }])
  assert.ok(dirty.error)
})
