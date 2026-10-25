import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  PARENTING_DEMO_CODE,
  demoCopyPlain,
  demoLooksFull,
  demoWriteBlocked,
  reduceParentingDemo,
  roleLine,
  seedParentingDemo,
  tidyParentingCast,
} from '../../src/lib/parenting-demo'

test('the parenting practice room starts full and uses plain words', () => {
  const cast = tidyParentingCast({ learner: 'Abdallah', teacher: 'Sami', portalAdmin: 'Rafiq', portalName: 'Guiding Home Learning', master: 'Leon' })
  const state = seedParentingDemo(cast)
  assert.equal(PARENTING_DEMO_CODE, 'PARENT-DEMO')
  assert.equal(demoLooksFull(state), true)
  assert.equal(state.people.filter((person) => person.role === 'learner').length >= 4, true)
  assert.ok(state.answers.some((row) => row.learner === 'Abdallah'))
  assert.equal(state.notes[0]?.from, 'Sami')
  assert.equal(JSON.stringify(state).includes('@'), false)
  assert.equal(demoCopyPlain(`${roleLine(cast, 'learner')} ${roleLine(cast, 'teacher')} ${roleLine(cast, 'portal')} ${state.notes[0]?.body}`), true)
})

test('an answer shows for the teacher, a note shows for the learner, and a switch changes the home page', () => {
  const cast = tidyParentingCast({})
  const start = seedParentingDemo(cast)
  const answered = reduceParentingDemo(start, {
    type: 'answer',
    body: 'I will keep the same hour after school.',
    film: 'Home Learning Introduction 2: How To Use This Course',
    lessonId: 12,
    prompt: 'What aspects of home learning would you like further guidance with?',
  }, cast)
  assert.equal(answered.seq, start.seq + 1)
  assert.equal(answered.answers[0]?.learner, cast.learner)
  assert.match(answered.answers[0]?.body || '', /same hour/)
  assert.equal(answered.people.find((person) => person.name === cast.learner)?.watching.includes('How To Use'), true)

  const noted = reduceParentingDemo(answered, { type: 'note', body: 'Try the third film tonight.', from: cast.teacher }, cast)
  assert.equal(noted.notes[0]?.body, 'Try the third film tonight.')
  assert.equal(noted.notes[0]?.from, 'Sami')

  const switched = reduceParentingDemo(noted, {
    type: 'features',
    features: { notes: false, progress: true, plan: true, kinetic: true, saved: true },
  }, cast)
  assert.equal(switched.features.notes, false)
  assert.equal(switched.features.plan, true)

  const again = reduceParentingDemo(switched, { type: 'watch', film: 'Home Learning Introduction 2: How To Use This Course', lessonId: 99 }, cast)
  assert.equal(again, switched)

  const fresh = reduceParentingDemo(switched, { type: 'reset' }, cast)
  assert.equal(fresh.seq, switched.seq + 1)
  assert.equal(fresh.features.plan, false)
  assert.match(fresh.notes[0]?.body || '', /first film/)
  assert.equal(fresh.answers.some((row) => /same hour/.test(row.body)), false)
})

test('a practice frame cannot write the real course', () => {
  const room = 'a'.repeat(24)
  assert.equal(demoWriteBlocked('POST', 'http://localhost/api/hearts', `http://localhost/p/parenting?demo=${room}`), true)
  assert.equal(demoWriteBlocked('POST', 'http://localhost/api/hearts/demo', `http://localhost/p/parenting?demo=${room}`), false)
  assert.equal(demoWriteBlocked('POST', 'http://localhost/api/hearts', 'http://localhost/p/parenting'), false)
  assert.equal(demoWriteBlocked('POST', 'http://localhost/api/hearts', 'http://localhost/login?next=/demo-stage&demo=stage'), false)
  assert.equal(demoWriteBlocked('GET', `http://localhost/api/hearts?demo=${room}`, null), false)
})
