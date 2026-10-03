import assert from 'node:assert/strict'
import test from 'node:test'
import { demoTimeline, finishedBySchedule, formatOnTime, onTimeProgress, ON_TIME_HINT } from './on-time'

test('finishing on or before the earliest scheduled day counts, and a later plan does not excuse a miss', () => {
  assert.equal(finishedBySchedule(['2026-10-03', '2026-10-10'], '2026-10-03'), true)
  assert.equal(finishedBySchedule(['2026-10-03', '2026-10-10'], '2026-10-02'), true)
  assert.equal(finishedBySchedule(['2026-10-10', '2026-10-03'], '2026-10-04'), false)
  assert.equal(finishedBySchedule([], '2026-10-03'), false)
})

test('the fraction is parts finished on time out of parts due by today', () => {
  const slots = [
    { lessonId: 1, date: '2026-10-01' },
    { lessonId: 2, date: '2026-10-02' },
    { lessonId: 3, date: '2026-10-05' },
  ]
  const progress = onTimeProgress(slots, [
    { lessonId: 1, watchedOn: '2026-10-01' },
    { lessonId: 2, watchedOn: '2026-10-04' },
    { lessonId: 3, watchedOn: '2026-10-03' },
  ], '2026-10-03')
  assert.deepEqual(progress, { onTime: 1, due: 2, planned: 3 })
  assert.equal(formatOnTime(progress), '1 of 2')
  assert.equal(formatOnTime(onTimeProgress([], [], '2026-10-03')), '—')
  assert.match(ON_TIME_HINT, /study plan/)
  assert.match(ON_TIME_HINT, /due by today/)
})

test('the same day is read from an ISO time or a date-only string', () => {
  const progress = onTimeProgress(
    [{ lessonId: 1, date: '2026-10-03T18:00:00.000Z' }],
    [{ lessonId: 1, watchedOn: '2026-10-03' }],
    '2026-10-03T09:00:00.000Z',
  )
  assert.equal(formatOnTime(progress), '1 of 1')
})

test('the four demo histories come out as different, realistic columns', () => {
  const today = '2026-10-03'
  const timeline = demoTimeline(today, [1, 2, 3, 4, 5, 6, 7, 8, 9])
  const lines = Object.fromEntries(timeline.people.map((person) => {
    const progress = onTimeProgress(timeline.slots, person.watches, today)
    return [person.key, { line: formatOnTime(progress), watched: person.watches.length, answers: person.answers.length, progress }]
  }))
  assert.deepEqual(lines['on-schedule'], { line: '7 of 7', watched: 7, answers: 4, progress: { onTime: 7, due: 7, planned: 9 } })
  assert.deepEqual(lines.behind, { line: '1 of 7', watched: 3, answers: 1, progress: { onTime: 1, due: 7, planned: 9 } })
  assert.deepEqual(lines.ahead, { line: '7 of 7', watched: 9, answers: 6, progress: { onTime: 7, due: 7, planned: 9 } })
  assert.deepEqual(lines['answers-late'], { line: '5 of 7', watched: 5, answers: 5, progress: { onTime: 5, due: 7, planned: 9 } })
  const late = timeline.people.find((person) => person.key === 'answers-late')!
  for (const answer of late.answers) {
    const slot = timeline.slots.find((row) => row.lessonId === answer.lessonId)!
    assert.ok(answer.answeredOn > slot.date)
  }
  const names = new Set(timeline.people.map((person) => person.name))
  assert.equal(names.size, 4)
  for (const person of timeline.people) assert.match(person.name, /\(demo\)$/)
})
