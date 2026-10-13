import assert from 'node:assert/strict'
import { test } from 'node:test'
import { talkPartOpen } from '../../src/lib/talk-part'

const lesson = { id: 90, courseId: 47, publishState: 'published', transcriptNote: null }

test('a full talk opens only when that lesson is a visible part of that course', () => {
  assert.equal(talkPartOpen({ courseId: 47, lessonId: 90, courseExists: true, lesson }), true)
  assert.equal(talkPartOpen({ courseId: 47, lessonId: 90, courseExists: false, lesson }), false)
  assert.equal(talkPartOpen({ courseId: 47, lessonId: 90, courseExists: true, lesson: null }), false)
  assert.equal(talkPartOpen({ courseId: 47, lessonId: 91, courseExists: true, lesson }), false)
  assert.equal(talkPartOpen({ courseId: 12, lessonId: 90, courseExists: true, lesson }), false)
  assert.equal(talkPartOpen({ courseId: 47, lessonId: 90, courseExists: true, lesson: { ...lesson, publishState: 'draft' } }), false)
})
