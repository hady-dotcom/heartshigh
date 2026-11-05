import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cleanTitle, uniqueSavedTalks } from './clean-title'

test('cleanTitle drops a pipe suffix and a YouTube “by” tail', () => {
  assert.equal(cleanTitle('Dua 1: O Allah, I am Your Servant | Prophetic Dua | Shaykh Yasir Fahmy'), 'Dua 1: O Allah, I am Your Servant')
  assert.equal(cleanTitle('Tawakkul: Supreme Trust in Allah - Khutbah by Sh. Mohammed Elshinawy'), 'Tawakkul: Supreme Trust in Allah')
  assert.equal(cleanTitle('Anger Management (p. 1) :: Khutbah by Sh Mohammad Elshinawy'), 'Anger Management (p. 1)')
  assert.equal(cleanTitle('How to Live Like the Prophet, Session 6'), 'How to Live Like the Prophet, Session 6')
})

test('uniqueSavedTalks keeps one row per talk', () => {
  assert.deepEqual(
    uniqueSavedTalks(['cut-12', 'cut-9', 'cut-41'], {
      'cut-12': { talk: 'lesson-6', title: 'How to Live Like the Prophet, Session 6' },
      'cut-9': { talk: 'lesson-6', title: 'How to Live Like the Prophet, Session 6' },
      'cut-41': { talk: 'lesson-20', title: 'Tawakkul: Supreme Trust in Allah' },
    }),
    ['cut-12', 'cut-41'],
  )
})
