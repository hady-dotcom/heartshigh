import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hasHeartsWord, hasIslamicWording } from './sequence'
import { parentOpeningScenes } from './parent-opening'

test('the parent opening set is eight plain questions and keeps no HEARTS wording', () => {
  const scenes = parentOpeningScenes()
  assert.equal(scenes.length, 8)
  for (const scene of scenes) {
    assert.equal(scene.layout, 'grid4')
    assert.equal(scene.subline, 'Go with your first thought.')
    assert.equal(scene.options.length, 4)
    const text = [scene.caption, scene.subline, ...scene.options.map((option) => option.label)].join(' ')
    assert.equal(hasIslamicWording(text), false, text)
    assert.equal(hasHeartsWord(text), false, text)
  }
  assert.match(scenes[0].caption, /How old are the children/)
  assert.match(scenes[4].caption, /get better at/)
})
