import assert from 'node:assert/strict'
import { test } from 'node:test'
import { minutesTowardAsk, missionProgress, shapedLine, thankYouFanOut, weekMinutesFromSeconds } from './mission-maths'

test('mission progress counts joined against the target', () => {
  const row = missionProgress(412, 700)
  assert.equal(row.joined, 412)
  assert.equal(row.target, 700)
  assert.equal(row.remaining, 288)
  assert.equal(row.reached, false)
  assert.equal(row.line, '412 of 700 have joined')
  assert.equal(row.pct, 59)
  assert.equal(missionProgress(700, 700).reached, true)
  assert.equal(missionProgress(3, 0).line, '3 have joined')
})

test('week minutes come from real seconds of use', () => {
  assert.equal(weekMinutesFromSeconds(3600), 60)
  assert.equal(weekMinutesFromSeconds(90), 2)
  const toward = minutesTowardAsk(25, 60)
  assert.equal(toward.done, false)
  assert.equal(toward.line, '25 of 60 minutes this week')
  assert.equal(minutesTowardAsk(60, 60).done, true)
})

test('thank-you fan-out writes one note per participant and skips duplicates', () => {
  const notes = thankYouFanOut(
    [
      { userId: 11, portalId: 2 },
      { userId: 12, portalId: 2 },
      { userId: 11, portalId: 2 },
      { userId: 0 },
    ],
    { missionId: 9, result: "the button now says 'Stay with this'", href: '/p/east-london/me/shaped' },
  )
  assert.equal(notes.length, 2)
  assert.equal(notes[0].user, 11)
  assert.equal(notes[1].user, 12)
  assert.equal(notes[0].key, 'mission-thanks-9-11')
  assert.match(notes[0].body, /You helped decide: the button now says 'Stay with this'/)
  assert.equal(notes[0].channel, 'in-app')
  assert.equal(shapedLine("the button now says 'Stay with this'"), "You helped decide: the button now says 'Stay with this'")
})
