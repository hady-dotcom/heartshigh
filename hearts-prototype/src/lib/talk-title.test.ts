import assert from 'node:assert/strict'
import { test } from 'node:test'
import { displayTalkTitle, partTitle, tidyTalkTitle } from './talk-title'

test('a real title is kept, and a slug or video id falls back to the course and part', () => {
  assert.equal(displayTalkTitle({ title: 'The heart of the matter', courseTitle: 'Names', part: 2 }), 'The heart of the matter')
  assert.equal(displayTalkTitle({ title: 'circle-recording', sourceTitle: 'Sitting with the names', courseTitle: 'Names', part: 1 }), 'Sitting with the names')
  assert.equal(displayTalkTitle({ title: 'A quiet morning', sourceTitle: 'YOUTUBE ORIGINAL', courseTitle: 'Names', part: 1 }), 'A quiet morning')
  assert.equal(displayTalkTitle({ title: 'circle-recording', courseTitle: 'The names', part: 3 }), 'The names · Part 3')
  assert.equal(displayTalkTitle({ title: 'Vimeo 76979871', vimeoId: '76979871', courseTitle: 'Light', part: 2 }), 'Light · Part 2')
  assert.equal(displayTalkTitle({ title: 'NIR88RRpat4', youtubeId: 'NIR88RRpat4', courseTitle: 'Nur', part: 1 }), 'Nur · Part 1')
  assert.equal(displayTalkTitle({ title: 'Tawhid', courseTitle: 'Names', part: 4 }), 'Tawhid')
  assert.equal(displayTalkTitle({ title: '', courseTitle: '', part: 2 }), 'Part 2')
  assert.equal(tidyTalkTitle('Dua 1: O Allah, I am Your Servant | Prophetic Dua | Shaykh Yasir Fahmy'), 'Dua 1: O Allah, I am Your Servant')
  assert.equal(tidyTalkTitle('A short talk — Shaykh Yasir Fahmy'), 'A short talk')
  assert.equal(displayTalkTitle({ title: 'Dua 1: O Allah, I am Your Servant | Prophetic Dua | Shaykh Yasir Fahmy', courseTitle: 'Duas', part: 1 }), 'Dua 1: O Allah, I am Your Servant')
  assert.equal(partTitle({ title: 'circle-recording', order: 3, vimeoId: '76979871' }, 'The names'), 'The names · Part 3')
  assert.equal(partTitle({ title: 'Vimeo 76979871', order: 2, vimeoId: '76979871' }, 'Light'), 'Light · Part 2')
})
