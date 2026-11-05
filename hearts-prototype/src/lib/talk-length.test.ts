import assert from 'node:assert/strict'
import { test } from 'node:test'
import { learnerLessonVisible } from './publish-state'
import { STARTERS } from '../seed/starters-data'
import {
  coursesEmptiedByShortTalks,
  isUnderMinTalk,
  MIN_TALK_SECONDS,
  refusalForTalk,
  sourceTalkSeconds,
  talksToHide,
  tooShortMessage,
  transcriptEndSeconds,
} from './talk-length'

const TIMED = `WEBVTT

00:00:01.000 --> 00:00:40.000
The opening.

00:01:00.000 --> 00:01:04.000
The last line.
`

test('five minutes is the shared floor', () => {
  assert.equal(MIN_TALK_SECONDS, 300)
  assert.equal(isUnderMinTalk(299), true)
  assert.equal(isUnderMinTalk(300), false)
  assert.equal(isUnderMinTalk(301), false)
  assert.equal(isUnderMinTalk(0), false)
  assert.equal(isUnderMinTalk(null), false)
  assert.equal(tooShortMessage(64), 'This talk is 1:04. Talks need to be at least 5 minutes.')
  assert.equal(refusalForTalk(64), 'This talk is 1:04. Talks need to be at least 5 minutes.')
  assert.equal(refusalForTalk(300), null)
  assert.equal(refusalForTalk(90), 'This talk is 1:30. Talks need to be at least 5 minutes.')
  assert.equal(learnerLessonVisible({ publishState: 'published', tooShort: true }), false)
  assert.equal(learnerLessonVisible({ publishState: 'published', tooShort: false }), true)
  assert.equal(learnerLessonVisible({ publishState: 'published' }), true)
  assert.equal(learnerLessonVisible({ publishState: 'published', binned: true }), false)
})

test('length comes from YouTube metadata, then a timed transcript', () => {
  assert.equal(sourceTalkSeconds({ durationSeconds: 428, transcript: TIMED }), 428)
  assert.equal(sourceTalkSeconds({ durationSeconds: null, transcript: TIMED }), 64)
  assert.equal(sourceTalkSeconds({ durationSeconds: 0, transcript: TIMED }), 64)
  assert.equal(transcriptEndSeconds('Just a paragraph with no times at all. It keeps going so it is not empty.'), null)
  assert.equal(refusalForTalk(sourceTalkSeconds({ durationSeconds: null, transcript: TIMED })), 'This talk is 1:04. Talks need to be at least 5 minutes.')
})

test('the marker hides talks under five minutes and the courses they empty', () => {
  const lessons = [
    { id: 1, courseId: 10, durationSeconds: 64, tooShort: false, shortWaived: false },
    { id: 2, courseId: 10, durationSeconds: 600, tooShort: false, shortWaived: false },
    { id: 3, courseId: 11, durationSeconds: 90, tooShort: false, shortWaived: false },
    { id: 4, courseId: 12, durationSeconds: 80, tooShort: false, shortWaived: true },
    { id: 5, courseId: 13, durationSeconds: 64, tooShort: true, shortWaived: false },
  ]
  assert.deepEqual(talksToHide(lessons).map((row) => row.id), [1, 3])
  assert.deepEqual(coursesEmptiedByShortTalks(lessons), [11, 13])
})

test('seeded talks under five minutes are the ones the marker will hide', () => {
  const short = STARTERS.filter((row) => row.lengthSec != null && row.lengthSec < MIN_TALK_SECONDS)
  assert.equal(short.length, 9)
  const anxiety = short.find((row) => row.youtubeId === 'FAxIZIqwfd8')
  assert.equal(anxiety?.lengthSec, 64)
  assert.equal(tooShortMessage(anxiety?.lengthSec || 0), 'This talk is 1:04. Talks need to be at least 5 minutes.')
  assert.ok(short.every((row) => (row.lengthSec || 0) < MIN_TALK_SECONDS))
  assert.ok(STARTERS.filter((row) => (row.lengthSec || 0) >= MIN_TALK_SECONDS).length > short.length)
})
