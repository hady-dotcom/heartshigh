import assert from 'node:assert/strict'
import { test } from 'node:test'
import { helpFor, learnerHelp } from '../../src/lib/page-help'

test('feed and course help name Ready for more? and hide-until-moment', () => {
  const feed = helpFor('feed')
  assert.match(feed.body.join(' '), /Ready for more\?/)
  assert.equal(helpFor('appetiser').title, 'How to use Ready for more?')
  const course = helpFor('course')
  assert.match(course.body.join(' '), /Tap a question dot/)
  const buffet = helpFor('course-overview')
  assert.match(buffet.body.join(' '), /never shows the questions|Nothing here previews them/)
  assert.match(learnerHelp('hide-until-moment'), /tap its dot/)
  assert.match(helpFor('garden').body.join(' '), /Finished counts/)
})
