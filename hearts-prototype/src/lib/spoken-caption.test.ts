import assert from 'node:assert/strict'
import { test } from 'node:test'
import { foldCaption, spokenCaption } from './spoken-caption'

test('a caption is the timed spoken line and never the talk title', () => {
  const title = 'How to Live Like the Prophet, Session 6'
  assert.equal(spokenCaption({ text: title }, [title, 'How to Live Like the Prophet']), '')
  const spoken = spokenCaption({ text: 'Tawakkul is to trust Allah' }, [title])
  assert.ok(spoken)
  assert.notEqual(foldCaption(spoken), foldCaption(title))
  assert.match(spoken, /Tawakkul is to trust Allah/)
  assert.equal(spokenCaption(null, [title]), '')
  assert.equal(spokenCaption({ text: '' }, [title]), '')
})
