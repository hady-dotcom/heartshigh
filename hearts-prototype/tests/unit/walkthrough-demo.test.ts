import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_WALKTHROUGH_PASSWORD,
  WALKTHROUGH_PORTAL_SLUG,
  matchCourseKey,
  passwordForNewWalkthrough,
  walkthroughDemoGuard,
  walkthroughVoiceProblems,
  walkthroughWeekSlots,
} from '../../src/lib/walkthrough-demo'

test('the walkthrough seed may write hearts-demo in production, and nowhere else', () => {
  assert.equal(walkthroughDemoGuard('hearts-demo'), null)
  assert.match(walkthroughDemoGuard('east-london') || '', /hearts-demo/)
  assert.match(walkthroughDemoGuard(null) || '', /hearts-demo/)
})

test('a password is returned only when this run is creating the walkthrough account', () => {
  assert.equal(passwordForNewWalkthrough(false), null)
  assert.equal(passwordForNewWalkthrough(true, {}), DEFAULT_WALKTHROUGH_PASSWORD)
  assert.equal(passwordForNewWalkthrough(true, { HEARTS_DEMO_WALKTHROUGH_PASSWORD: 'a-long-host-password' }), 'a-long-host-password')
  assert.equal(passwordForNewWalkthrough(true, { HEARTS_DEMO_WALKTHROUGH_PASSWORD: 'short' }), DEFAULT_WALKTHROUGH_PASSWORD)
})

test('key demo talks match on title, token or YouTube id', () => {
  assert.equal(matchCourseKey({ title: 'The Names Class 19: Ar-Rabb' }), 'ar-rabb')
  assert.equal(matchCourseKey({ importToken: 'AR-RABB' }), 'ar-rabb')
  assert.equal(matchCourseKey({ youtubeId: 'ECaTWkof57E' }), 'ar-rabb')
  assert.equal(matchCourseKey({ title: 'How to Live Like the Prophet, Session 6' }), 'prophet')
  assert.equal(matchCourseKey({ title: 'Why You Feel Empty… And How Ramadan Fixes It | The Names Class 20: An-Nūr' }), 'nur')
  assert.equal(matchCourseKey({ title: 'Divinely Sheltered' }), 'sheltered')
  assert.equal(matchCourseKey({ title: 'A Divine Shelter for the Heart' }), 'sheltered')
  assert.equal(matchCourseKey({ title: 'Quranic Connection #26: A Cure for Anxiety' }), 'starter')
  assert.equal(matchCourseKey({ title: 'Dua 1: O Allah, I am Your Servant | Prophetic Dua' }), 'starter')
  assert.equal(matchCourseKey({ title: 'A talk from another chapter' }), null)
})

test('My week gets a few sittings on this week, including today', () => {
  const now = new Date('2026-10-05T16:00:00.000Z')
  const slots = walkthroughWeekSlots(now, [
    { id: 1, title: 'Ar-Rabb' },
    { id: 2, title: 'How to Live Like the Prophet' },
    { id: 3, title: 'Al-Nur' },
  ])
  assert.ok(slots.length >= 3)
  assert.ok(slots.some((slot) => slot.date === '2026-10-05'))
  assert.equal(new Set(slots.map((slot) => slot.lessonId)).size, slots.length)
})

test('walkthrough copy stays in a human voice and passes the circle checks', () => {
  assert.deepEqual(walkthroughVoiceProblems(), [])
})

test('the portal slug stays hearts-demo', () => {
  assert.equal(WALKTHROUGH_PORTAL_SLUG, 'hearts-demo')
})
