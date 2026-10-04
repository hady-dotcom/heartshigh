import assert from 'node:assert/strict'
import { test } from 'node:test'
import { LONG_SITTINGS, planSeriesMoves, seriesKey } from './series-group'

test('Names classes and Prophet sessions share a series key', () => {
  assert.equal(seriesKey('The Names Class 19: Ar-Rabb'), 'The Names')
  assert.equal(seriesKey('Why Wealth Won\'t Give You Peace | The Names Class 21: Ar - Razzaq', 'The Names'), 'The Names')
  assert.equal(seriesKey('How to Live Like the Prophet, Session 6'), 'How to Live Like the Prophet')
  assert.equal(seriesKey('The Names Class 20: Al-Nūr | Shaykh Mikaeel Smith', 'The Names: short clips'), 'The Names: short clips')
})

test('numbered Names classes group, short clips stay out, and ten long talks become Long sittings', () => {
  const names = [19, 20, 21].map((n, index) => ({
    id: n,
    title: `The Names Class ${n}: Name`,
    courseId: n,
    courseTitle: `The Names Class ${n}: Name`,
    durationSeconds: 2000 + index * 10,
  }))
  const clip = {
    id: 99,
    title: 'The Names Class 20: Al-Nūr',
    courseId: 99,
    courseTitle: 'The Names: short clips',
    durationSeconds: 98,
    series: 'The Names: short clips',
  }
  const longs = Array.from({ length: 12 }, (_, index) => ({
    id: 100 + index,
    title: `Long talk ${index + 1}`,
    courseId: 100 + index,
    courseTitle: `Long talk ${index + 1}`,
    durationSeconds: 3600 - index * 60,
  }))
  const plan = planSeriesMoves([...names, clip, ...longs])
  const namesGroup = plan.groups.find((group) => group.title === 'The Names')
  assert.deepEqual(namesGroup?.lessonIds, [19, 20, 21])
  assert.ok(!plan.groups.some((group) => group.lessonIds.includes(99)))
  const sitting = plan.groups.find((group) => group.title === LONG_SITTINGS)
  assert.equal(sitting?.lessonIds.length, 10)
  assert.deepEqual(sitting?.lessonIds, longs.slice(0, 10).map((row) => row.id))
  assert.ok(plan.moves.some((move) => move.lessonId === 19 && move.toTitle === 'The Names'))
  assert.ok(plan.shortMains.every((row) => row.seconds < 600))
})
