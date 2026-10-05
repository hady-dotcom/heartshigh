import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatCount, wipeIntro } from './copy'

test('wipe counts use a real singular', () => {
  assert.equal(formatCount(1, 'Garden notes'), '1 garden note')
  assert.equal(formatCount(2, 'Garden notes'), '2 garden notes')
  assert.equal(formatCount(1, 'Board notes'), '1 board note')
  assert.equal(formatCount(1, 'Watch history'), '1 watch history entry')
  assert.equal(formatCount(3, 'Watch history'), '3 watch history entries')
  assert.equal(formatCount(1, 'Learners'), '1 learner')
  assert.equal(formatCount(15, 'Learners'), '15 learners')
  assert.equal(formatCount(1, 'Files'), '1 file')
  assert.equal(formatCount(1, 'Parts watched'), '1 part watched')
  assert.equal(formatCount(5, 'Workbook entries'), '5 workbook entries')
})

test('the wipe sentence names the person once and does not list counts', () => {
  assert.equal(
    wipeIntro('user', 'Maryam Begum'),
    'This wipes everything Maryam Begum has done on HEARTS. It cannot be undone.',
  )
  assert.equal(
    wipeIntro('portal', 'East London Mosque'),
    'This wipes everything this portal has stored on HEARTS. It cannot be undone.',
  )
  assert.doesNotMatch(wipeIntro('user', 'Maryam Begum'), /\d/)
})
