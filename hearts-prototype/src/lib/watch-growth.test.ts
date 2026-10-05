import assert from 'node:assert/strict'
import { test } from 'node:test'
import { activityDay, countedTalkCompletions, doorsLitByCuts, gardenPathNodes, growthLessonIds, watchedLessonIds } from './watch-growth'

test('the watched ring counts a sitting even when the completion is still missing', () => {
  const ids = watchedLessonIds({
    completions: [],
    sessions: [{ lesson: 11, seconds: 90 }, { lesson: 12, seconds: 0 }, { lesson: { id: 11 }, seconds: 12 }],
  })
  assert.deepEqual([...ids].sort((a, b) => a - b), [11])
})

test('a finished talk and a partial sitting both count as watched', () => {
  const ids = watchedLessonIds({
    completions: [{ lesson: 4, sourceLevel: 'talk' }],
    sessions: [{ lesson: 9, seconds: 40 }],
  })
  assert.deepEqual([...ids].sort((a, b) => a - b), [4, 9])
})

test('parts watched keep only full talks that sit in a course', () => {
  const counted = countedTalkCompletions({
    completions: [
      { lesson: 1, sourceLevel: 'talk' },
      { lesson: 2, sourceLevel: 'appetiser' },
      { lesson: 3, sourceLevel: 'talk' },
      { lesson: 4, sourceLevel: 'talk' },
    ],
    courseByLesson: new Map([
      [1, 10],
      [2, 10],
      [3, null],
    ]),
  })
  assert.deepEqual(counted.map((row) => row.lesson), [1])
})

test('Garden days prefer the sitting or answer time over the row time', () => {
  assert.equal(activityDay({ watchedAt: '2026-10-03T18:00:00.000Z', createdAt: '2026-10-05T12:00:00.000Z' }), '2026-10-03')
  assert.equal(activityDay({ answeredAt: '2026-09-28T09:00:00.000Z', createdAt: '2026-10-05T12:00:00.000Z' }), '2026-09-28')
  assert.equal(activityDay({ createdAt: '2026-10-01T08:00:00.000Z' }), '2026-10-01')
})

test('Your path keeps every watched talk, not only the current course', () => {
  const nodes = gardenPathNodes(
    [
      { id: 4, title: 'One', href: '/c/1?part=4', done: true },
      { id: 9, title: 'Two', href: '/c/2?part=9', done: true },
    ],
    [{ id: 4, title: 'One', href: '/c/1?part=4', done: true }],
  )
  assert.deepEqual(nodes.map((row) => row.id), [4, 9])
  assert.equal(nodes.length, 2)
})

test('a sitting or an answer on a cut lights that door’s section', () => {
  const lit = doorsLitByCuts({
    cuts: [{ lesson: 4, bestClause: 22 }, { lesson: 9, bestClause: 15 }],
    watched: new Set([4]),
    done: new Set([4]),
    answered: new Set([9]),
    doorOf: (clause) => (clause === 22 ? 10 : clause === 15 ? 5 : null),
  })
  assert.deepEqual([...lit.lit].sort((a, b) => a - b), [10])
  assert.deepEqual([...lit.activityLit].sort((a, b) => a - b), [5, 10])
})

test('growth loads the sitting lesson so a completion can be placed in its course', () => {
  assert.deepEqual(
    growthLessonIds({
      completions: [{ lesson: 1 }],
      visits: [{ lesson: 2 }],
      answers: [{ lesson: 3 }],
      sessions: [{ lesson: 4, seconds: 20 }],
    }).sort((a, b) => a - b),
    [1, 2, 3, 4],
  )
})
