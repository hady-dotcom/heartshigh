import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EXPERIMENT_SLOTS } from './experiment-slots'
import { mockFaces, mockLine, mockTarget } from './experiment-mock'

test('every experiment slot maps to a learner screen and a highlighted element', () => {
  const feed = mockTarget('feed-cta-label')
  assert.equal(feed.screen, 'The feed')
  assert.equal(feed.kind, 'feed-button')
  assert.equal(feed.callout, 'This button changes')
  assert.equal(mockTarget('full-talk-cta-label').callout, 'This button changes')
  assert.equal(mockTarget('full-talk-cta-label').element, 'The button into the whole talk')
  assert.equal(mockTarget('lanes-tab-label').kind, 'lanes-tab')
  assert.equal(mockTarget('lanes-tab-label').callout, 'This tab changes')
  assert.equal(mockTarget('wide-video-framing').kind, 'video-frame')
  assert.equal(mockTarget('wide-video-framing').callout, 'This frame changes')
  for (const slot of EXPERIMENT_SLOTS) {
    const target = mockTarget(slot.key)
    assert.equal(target.slot, slot.key)
    assert.ok(target.screen.length > 0)
    assert.ok(target.callout.length > 0)
  }
  assert.equal(mockTarget('not-a-slot').callout, 'This part changes')
})

test('the mock shows version A and version B with the real words', () => {
  const faces = mockFaces([
    { key: 'watch-whole', label: 'Watch the whole talk (N min)', payload: { label: 'Watch the whole talk ({n} min)' } },
    { key: 'start-course', label: 'Start this course', payload: { label: 'Start this course' } },
    { key: 'extra', label: 'A third line', payload: { label: 'A third line' } },
  ])
  assert.equal(faces.length, 2)
  assert.deepEqual(faces.map((face) => face.letter), ['A', 'B'])
  assert.equal(mockLine(faces[0].text, 'talk-button'), 'Watch the whole talk (18 min)')
  assert.equal(mockLine(faces[1].text, 'talk-button'), 'Start this course')
  assert.equal(mockLine('split', 'video-frame'), 'split')
  assert.equal(mockLine('face-crop', 'video-frame'), 'face-crop')
})
