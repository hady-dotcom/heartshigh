import assert from 'node:assert/strict'
import { test } from 'node:test'
import { displayTalkTitle } from './talk-title'

test('a real title is kept, and a slug or video id falls back to the course and part', () => {
  assert.equal(displayTalkTitle({ title: 'The heart of the matter', courseTitle: 'Names', part: 2 }), 'The heart of the matter')
  assert.equal(displayTalkTitle({ title: 'circle-recording', sourceTitle: 'Sitting with the names', courseTitle: 'Names', part: 1 }), 'Sitting with the names')
  assert.equal(displayTalkTitle({ title: 'A quiet morning', sourceTitle: 'YOUTUBE ORIGINAL', courseTitle: 'Names', part: 1 }), 'A quiet morning')
  assert.equal(displayTalkTitle({ title: 'circle-recording', courseTitle: 'The names', part: 3 }), 'The names · Part 3')
  assert.equal(displayTalkTitle({ title: 'Vimeo 76979871', vimeoId: '76979871', courseTitle: 'Light', part: 2 }), 'Light · Part 2')
  assert.equal(displayTalkTitle({ title: 'NIR88RRpat4', youtubeId: 'NIR88RRpat4', courseTitle: 'Nur', part: 1 }), 'Nur · Part 1')
  assert.equal(displayTalkTitle({ title: 'Tawhid', courseTitle: 'Names', part: 4 }), 'Tawhid')
  assert.equal(displayTalkTitle({ title: '', courseTitle: '', part: 2 }), 'Part 2')
})
