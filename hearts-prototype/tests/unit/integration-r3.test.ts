import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isPortraitSize, isShortsUrl, isVerticalLesson } from '../../src/lib/shorts'

test('Shorts: a /shorts/ link or a 9:16 size is vertical, a watch link or a 16:9 size is not', () => {
  assert.ok(isShortsUrl('https://www.youtube.com/shorts/abcdefghijk'))
  assert.ok(isShortsUrl('https://youtube.com/shorts/abcdefghijk?feature=share'))
  assert.ok(isShortsUrl('https://m.youtube.com/shorts/abcdefghijk'))
  assert.ok(!isShortsUrl('https://www.youtube.com/watch?v=abcdefghijk'))
  assert.ok(!isShortsUrl('https://example.com/shorts/abcdefghijk'))
  assert.ok(!isShortsUrl(null))
  assert.ok(isPortraitSize(113, 200))
  assert.ok(isPortraitSize(1080, 1920))
  assert.ok(!isPortraitSize(200, 113))
  assert.ok(!isPortraitSize(500, 500))
  assert.ok(!isPortraitSize(undefined, 200))
  assert.ok(isVerticalLesson({ vertical: true }))
  assert.ok(isVerticalLesson({ sourceUrl: 'https://www.youtube.com/shorts/abcdefghijk' }))
  assert.ok(!isVerticalLesson({ youtubeUrl: 'https://youtu.be/abcdefghijk' }))
  assert.ok(!isVerticalLesson(null))
})
