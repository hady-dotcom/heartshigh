import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sharedAnswerText, sharedAnswerWhere, sharedAnswersNewestFirst, sharedWithTeacher, teachSeenAt, withTeachSeen } from './shared-answers'

const typed = { id: 2, body: 'I wrote this down', keepPrivate: false, shareWithTeacher: true, createdAt: '2026-10-13T10:00:00.000Z' }
const choice = { id: 3, choice: 'The second one', keepPrivate: false, shareWithTeacher: true, createdAt: '2026-10-13T11:00:00.000Z' }
const recording = { id: 4, video: 9, keepPrivate: false, shareWithTeacher: true, createdAt: '2026-10-13T09:00:00.000Z' }
const kept = { id: 5, body: 'Only for me', keepPrivate: true, shareWithTeacher: true, createdAt: '2026-10-13T12:00:00.000Z' }
const withheld = { id: 6, body: 'Not offered', keepPrivate: false, shareWithTeacher: false, createdAt: '2026-10-13T12:30:00.000Z' }
const consented = { id: 7, body: 'Workbook share', keepPrivate: false, shareWithTeacher: false, createdAt: '2026-10-13T08:00:00.000Z' }

test('shared answers include typed text and recordings, hide private ones, and sort newest first', () => {
  assert.equal(sharedWithTeacher(kept), false)
  assert.equal(sharedWithTeacher(withheld), false)
  assert.equal(sharedWithTeacher(typed), true)
  assert.equal(sharedWithTeacher(consented, new Set([7])), true)
  assert.equal(sharedWithTeacher({ ...kept, id: 5 }, new Set([5])), false)
  const shown = sharedAnswersNewestFirst([typed, recording, kept, withheld, choice, consented], new Set([7]))
  assert.deepEqual(shown.map((row) => row.id), [3, 2, 4, 7])
  assert.equal(sharedAnswerText(typed), 'I wrote this down')
  assert.equal(sharedAnswerText(choice), 'The second one')
  assert.equal(sharedAnswerText(recording), 'A recording')
  assert.equal(sharedAnswerText({ body: 'Note', choice: 'Yes' }), 'Note Yes')
})

test('new answers are those shared after the last Teach visit in that portal', () => {
  assert.equal(teachSeenAt(null, 4), null)
  assert.equal(teachSeenAt({ 4: '2026-10-13T10:30:00.000Z', 9: '2026-10-01T00:00:00.000Z' }, 4), '2026-10-13T10:30:00.000Z')
  const next = withTeachSeen({ 9: '2026-10-01T00:00:00.000Z' }, 4, '2026-10-13T12:00:00.000Z')
  assert.deepEqual(next, { 9: '2026-10-01T00:00:00.000Z', 4: '2026-10-13T12:00:00.000Z' })
  const since = sharedAnswerWhere(4, '2026-10-13T10:30:00.000Z')
  assert.deepEqual(since.and[0], { portal: { equals: 4 } })
  assert.deepEqual(since.and[1], { shareWithTeacher: { equals: true } })
  assert.deepEqual(since.and[2], { keepPrivate: { not_equals: true } })
  assert.deepEqual(since.and[3], { createdAt: { greater_than: '2026-10-13T10:30:00.000Z' } })
  assert.equal(sharedAnswerWhere(4, null).and.length, 3)
})
