import assert from 'node:assert/strict'
import { test } from 'node:test'
import { groupSeriesEnabled, planSeriesMoves, seriesKey } from './series-group'

test('Names classes and Prophet sessions share a series key', () => {
  assert.equal(seriesKey('The Names Class 19: Ar-Rabb'), 'The Names')
  assert.equal(seriesKey('Why Wealth Won\'t Give You Peace | The Names Class 21: Ar - Razzaq', 'The Names'), 'The Names')
  assert.equal(seriesKey('How to Live Like the Prophet, Session 6'), 'How to Live Like the Prophet')
  assert.equal(seriesKey('The Names Class 20: Al-Nūr | Shaykh Mikaeel Smith', 'The Names: short clips'), 'The Names: short clips')
})

test('numbered Names classes group by series and speaker; leftover longs stay put', () => {
  const names = [19, 20, 21].map((n, index) => ({
    id: n,
    title: `The Names Class ${n}: Name`,
    courseId: n,
    courseTitle: `The Names Class ${n}: Name`,
    durationSeconds: 2000 + index * 10,
    speaker: 'Shaykh Mikaeel Smith',
  }))
  const clip = {
    id: 99,
    title: 'The Names Class 20: Al-Nūr',
    courseId: 99,
    courseTitle: 'The Names: short clips',
    durationSeconds: 98,
    series: 'The Names: short clips',
    speaker: 'Shaykh Mikaeel Smith',
  }
  const longs = Array.from({ length: 12 }, (_, index) => ({
    id: 100 + index,
    title: `Long talk ${index + 1}`,
    courseId: 100 + index,
    courseTitle: `Long talk ${index + 1}`,
    durationSeconds: 3600 - index * 60,
    speaker: `Speaker ${index + 1}`,
  }))
  const plan = planSeriesMoves([...names, clip, ...longs])
  const namesGroup = plan.groups.find((group) => group.title === 'The Names')
  assert.deepEqual(namesGroup?.lessonIds, [19, 20, 21])
  assert.ok(!plan.groups.some((group) => group.lessonIds.includes(99)))
  assert.ok(!plan.groups.some((group) => group.title === 'Long sittings'))
  assert.ok(plan.groups.every((group) => group.lessonIds.every((id) => id < 100)))
  assert.ok(plan.moves.some((move) => move.lessonId === 19 && move.toTitle === 'The Names'))
  assert.ok(plan.shortMains.every((row) => row.seconds < 600))
})

test('the same numbered series with two speakers stays as two groups, never a leftover buffet', () => {
  const plan = planSeriesMoves([
    { id: 1, title: 'Patience, Session 1', courseId: 1, courseTitle: 'A', durationSeconds: 3600, speaker: 'Amina Yusuf' },
    { id: 2, title: 'Patience, Session 2', courseId: 2, courseTitle: 'B', durationSeconds: 3600, speaker: 'Amina Yusuf' },
    { id: 3, title: 'Patience, Session 1', courseId: 3, courseTitle: 'C', durationSeconds: 3600, speaker: 'Omar Khan' },
    { id: 4, title: 'Patience, Session 2', courseId: 4, courseTitle: 'D', durationSeconds: 3600, speaker: 'Omar Khan' },
    { id: 5, title: 'A lone long talk', courseId: 5, courseTitle: 'E', durationSeconds: 7200, speaker: 'Someone' },
  ])
  assert.equal(plan.groups.length, 2)
  assert.ok(plan.groups.every((group) => group.title === 'Patience'))
  assert.ok(!plan.moves.some((move) => move.lessonId === 5))
})

test('grouping is off unless HEARTS_GROUP_SERIES=1', () => {
  assert.equal(groupSeriesEnabled({}), false)
  assert.equal(groupSeriesEnabled({ HEARTS_GROUP_SERIES: '0' }), false)
  assert.equal(groupSeriesEnabled({ HEARTS_GROUP_SERIES: '1' }), true)
})
