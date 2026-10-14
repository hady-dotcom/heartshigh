import assert from 'node:assert/strict'
import test from 'node:test'
import {
  anonymiseProps,
  anonymisedSubject,
  diaryShowsWords,
  learnerActionRefusal,
  nameMatches,
  planActionRefusal,
  planAfterLearnerGone,
  temporaryPassword,
  tooManyBulk,
} from './learner-desk'

const elm = { role: 'portal-admin', portalId: 1 }
const leeds = { role: 'portal-admin', portalId: 2 }
const master = { role: 'master', portalId: null }
const teacher = { role: 'teacher', portalId: 1 }
const elmLearner = { role: 'learner', portalId: 1 }
const leedsLearner = { role: 'learner', portalId: 2 }

test('a portal admin cannot touch a learner in another portal', () => {
  for (const action of ['reset', 'pause', 'unpause', 'remove', 'delete', 'read'] as const) {
    assert.match(learnerActionRefusal(elm, leedsLearner, action) || '', /another portal/)
  }
  assert.equal(learnerActionRefusal(elm, elmLearner, 'reset'), null)
  assert.equal(learnerActionRefusal(elm, elmLearner, 'delete'), null)
  assert.match(learnerActionRefusal(elm, elmLearner, 'move') || '', /master desk/)
})

test('the master desk can act on every portal, and a teacher cannot change accounts', () => {
  assert.equal(learnerActionRefusal(master, leedsLearner, 'move'), null)
  assert.equal(learnerActionRefusal(master, elmLearner, 'delete'), null)
  assert.match(learnerActionRefusal(teacher, elmLearner, 'pause') || '', /portal admin or the master/)
  assert.match(learnerActionRefusal(leeds, { role: 'teacher', portalId: 2 }, 'reset') || '', /not a learner/)
})

test('study plans and diaries stay inside the portal', () => {
  assert.match(planActionRefusal(elm, 2) || '', /another portal/)
  assert.equal(planActionRefusal(elm, 1), null)
  assert.equal(planActionRefusal(teacher, 1, 'delete'), null)
  assert.match(planActionRefusal(teacher, 2, 'delete') || '', /another portal/)
  assert.match(planActionRefusal(master, 2) || '', /^$/)
})

test('diary words show only when the learner shared them and the answer is not private', () => {
  assert.equal(diaryShowsWords({ consent: true }, { keepPrivate: false }), true)
  assert.equal(diaryShowsWords({ consent: true }, null), true)
  assert.equal(diaryShowsWords({ consent: false }, { keepPrivate: false }), false)
  assert.equal(diaryShowsWords({ consent: true }, { keepPrivate: true }), false)
  assert.equal(diaryShowsWords({ consent: false }, { keepPrivate: true }), false)
})

test('deleting an account types the name exactly, and a shared plan keeps the other learners', () => {
  assert.equal(nameMatches('Maryam Begum', 'Maryam Begum'), true)
  assert.equal(nameMatches('  Maryam Begum  ', 'Maryam Begum'), true)
  assert.equal(nameMatches('maryam begum', 'Maryam Begum'), false)
  assert.equal(nameMatches('delete', 'Maryam Begum'), false)
  assert.equal(planAfterLearnerGone({ ownerId: 4, learnerIds: [4] }, 4), 'delete')
  assert.deepEqual(planAfterLearnerGone({ ownerId: 9, learnerIds: [4, 5] }, 4), { learnerIds: [5], ownerId: 9 })
  assert.deepEqual(planAfterLearnerGone({ ownerId: 4, learnerIds: [4, 5] }, 4), { learnerIds: [5], ownerId: null })
})

test('analytics lose the name and the email, and the row can stay', () => {
  assert.equal(anonymisedSubject('42', 42, 'a@hearts.test'), 'removed')
  assert.equal(anonymisedSubject('learner:42', 42, null), 'removed')
  assert.equal(anonymisedSubject('a@hearts.test', 42, 'A@hearts.test'), 'removed')
  assert.equal(anonymisedSubject('sess-9', 42, 'a@hearts.test'), 'sess-9')
  const props = anonymiseProps(
    { email: 'a@hearts.test', name: 'Aisha Patel', step: 'clip_cta_tap', learner: 42, n: 3 },
    { id: 42, email: 'a@hearts.test', name: 'Aisha Patel' },
  )
  assert.deepEqual(props, { step: 'clip_cta_tap', n: 3 })
})

test('a temporary password is readable and long enough, and bulk has a cap', () => {
  const password = temporaryPassword(Uint8Array.from({ length: 12 }, (_, index) => index + 1))
  assert.equal(password.length, 12)
  assert.match(password, /^[A-Za-z0-9]+$/)
  assert.match(tooManyBulk(0) || '', /at least one/)
  assert.match(tooManyBulk(26) || '', /25/)
  assert.equal(tooManyBulk(3), null)
})
