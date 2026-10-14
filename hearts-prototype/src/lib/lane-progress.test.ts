import assert from 'node:assert/strict'
import { test } from 'node:test'
import { LANES, getLaneProgress as progressFromOpening } from './opening-data'
import {
  LANE_PROGRESS_EXAMPLE,
  doneLine,
  feedBackHref,
  getLaneProgress,
  isLaneId,
  lanePagePath,
  lanePlayPath,
  minutesWatchedLabel,
  type LaneProgressClip,
} from './lane-progress'

const clips: LaneProgressClip[] = [
  { cutId: 10, lessonId: 1, start: 12, end: 30, durationSeconds: 600 },
  { cutId: 11, lessonId: 1, start: 40, end: 70, durationSeconds: 600 },
  { cutId: 12, lessonId: 2, start: 0, end: 20, durationSeconds: 180 },
]

test('lane ids stay on the opening list, and getLaneProgress is the same helper', () => {
  assert.deepEqual(LANES.map((lane) => lane.key), ['trust', 'company', 'lightness', 'quiet', 'talking', 'habits', 'patience', 'gifts', 'mercy', 'guarding-gaze'])
  assert.equal(isLaneId('trust'), true)
  assert.equal(isLaneId('not-a-lane'), false)
  assert.equal(getLaneProgress, progressFromOpening)
  assert.equal(getLaneProgress('trust').title, 'Trust')
  assert.equal(getLaneProgress('trust').found, true)
  assert.equal(getLaneProgress('made-up').found, false)
})

test('a lane with no watching is not started, and the example is labelled 4 of 12', () => {
  const progress = getLaneProgress('patience', clips)
  assert.equal(progress.started, false)
  assert.equal(progress.line, '0 of 3 done')
  assert.equal(progress.minutesWatched, 0)
  assert.equal(progress.minutesLabel, '0 minutes watched')
  assert.equal(progress.ratio, 0)
  assert.equal(progress.nextCutId, 10)
  assert.equal(progress.playCutId, 10)
  assert.deepEqual(progress.doneCutIds, [])
  assert.equal(LANE_PROGRESS_EXAMPLE.line, '4 of 12 done')
  assert.equal(LANE_PROGRESS_EXAMPLE.minutesLabel, '18 minutes watched')
  assert.equal(doneLine(4, 12), '4 of 12 done')
  assert.equal(minutesWatchedLabel(1), '1 minute watched')
  assert.equal(minutesWatchedLabel(0, 20), 'Under a minute watched')
})

test('a finished talk marks its clips done, and minutes are counted once', () => {
  const progress = getLaneProgress('company', clips, {
    completions: [{ lessonId: 1, percent: 100 }],
  })
  assert.equal(progress.started, true)
  assert.equal(progress.done, 2)
  assert.equal(progress.total, 3)
  assert.equal(progress.line, '2 of 3 done')
  assert.equal(progress.ratio, 2 / 3)
  assert.deepEqual(progress.doneCutIds, [10, 11])
  assert.equal(progress.nextCutId, 12)
  assert.equal(progress.playCutId, 12)
  assert.equal(progress.minutesWatched, 10)
  assert.equal(progress.minutesLabel, '10 minutes watched')
})

test('a short watch finishes only the clips it has reached', () => {
  const early = getLaneProgress('trust', clips, { sessions: [{ lessonId: 1, seconds: 31 }, { lessonId: 1, seconds: 10 }] })
  assert.deepEqual(early.doneCutIds, [10])
  assert.equal(early.minutesWatched, 1)
  assert.equal(early.nextCutId, 11)
  const later = getLaneProgress('trust', clips, { sessions: [{ lessonId: 1, seconds: 80 }] })
  assert.deepEqual(later.doneCutIds, [10, 11])
  const partial = getLaneProgress('trust', clips, { completions: [{ lessonId: 2, percent: 40 }] })
  assert.equal(partial.done, 0)
  assert.equal(partial.started, true)
  assert.equal(partial.minutesWatched, 1)
})

test('the last clip sends Continue back to the first, and play links return to the lane page', () => {
  const progress = getLaneProgress('mercy', clips, {
    completions: [
      { lessonId: 1, percent: 90 },
      { lessonId: 2, percent: 100 },
    ],
  })
  assert.equal(progress.done, 3)
  assert.equal(progress.nextCutId, null)
  assert.equal(progress.playCutId, 10)
  assert.equal(lanePagePath('/p/east-london', 'good company'), '/p/east-london/lanes/good%20company')
  assert.equal(lanePlayPath('/p/east-london', 'trust', 10), '/p/east-london/feed?lane=trust&clip=10&from=lane')
  assert.equal(feedBackHref('/p/east-london', { from: 'lane', lane: 'trust' }), '/p/east-london/lanes/trust')
  assert.equal(feedBackHref('/p/east-london', { from: 'home', lane: 'trust' }), null)
  assert.equal(feedBackHref('/p/east-london', { from: 'lane', lane: 'Trust' }), null)
})
