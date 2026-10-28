import assert from 'node:assert/strict'
import test from 'node:test'
import { coverColor, coverHue, coverIcon, coverPath, coverSvg } from './cover-art'

test('a cover is the same picture every time, and a different item is a different picture', () => {
  const first = coverSvg({ seed: 'course:33', title: 'Welcome', hue: coverHue(33) })
  const again = coverSvg({ seed: 'course:33', title: 'Welcome', hue: coverHue(33) })
  const other = coverSvg({ seed: 'course:40', title: 'Social and Emotional Readiness', hue: coverHue(40) })
  assert.equal(first, again)
  assert.notEqual(first, other)
  assert.equal(coverHue(33), coverHue(33))
  assert.notEqual(coverColor(33), coverColor(40))
})

test('the symbol follows the topic and the picture is a drawn mesh, not a film still', () => {
  assert.equal(coverIcon('Book Summaries', 'course:1'), 'book')
  assert.equal(coverIcon('Working with your Child', 'course:2'), 'people')
  assert.equal(coverIcon('Focus at the table', 'film:9'), 'target')
  const svg = coverSvg({ seed: 'film:9', title: 'Focus at the table', hue: 28 })
  assert.match(svg, /<circle/)
  assert.doesNotMatch(svg, /feTurbulence|feGaussianBlur/)
  assert.doesNotMatch(svg, /emoji|clipart|youtube|vimeo/i)
  assert.equal(coverPath('course', 33), '/cover/course/33')
})
