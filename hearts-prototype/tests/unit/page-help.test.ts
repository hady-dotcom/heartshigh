import assert from 'node:assert/strict'
import { test } from 'node:test'
import { helpFor, helpPageKey, learnerHelp } from '../../src/lib/page-help'

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

test('each learner surface keeps its own ? copy', () => {
  const pairs: [string, string][] = [
    ['start', 'How to use the opening'],
    ['help', 'How to use Help'],
    ['feed', 'How to use clips'],
    ['appetiser', 'How to use Ready for more?'],
    ['join', 'How to join'],
    ['login', 'How to sign in'],
    ['welcome', 'How to use Welcome'],
    ['welcome-films', 'How to use Welcome'],
    ['placing', 'How to begin'],
    ['lanes', 'How to use Lanes'],
    ['plan', 'How to use My week'],
    ['garden', 'How to use the Garden'],
    ['garden-door', 'How to use the twenty doors'],
    ['me', 'How to use Me'],
    ['course', 'How to use a talk'],
    ['course-overview', 'How to use this course'],
    ['support-page', 'How to ask for help'],
    ['gather', 'How to use Gather'],
  ]
  for (const [page, title] of pairs) {
    assert.equal(helpFor(page).title, title, page)
  }
  assert.notEqual(helpFor('help').title, helpFor('start').title)
  assert.notEqual(helpFor('feed').title, helpFor('appetiser').title)
  assert.notEqual(helpFor('me').title, helpFor('garden').title)
  assert.match(helpFor('help').body.join(' '), /call or visit/)
  assert.doesNotMatch(helpFor('help').body.join(' '), /first talk/)
  assert.match(helpFor('me').body.join(' '), /install card/)
})

test('screen test ids alias to the matching page, never a stranger', () => {
  assert.equal(helpPageKey('welcome-films'), 'welcome')
  assert.equal(helpPageKey('garden-door'), 'garden-jibril')
  assert.equal(helpPageKey('mission-missing'), 'mission-page')
  assert.equal(helpPageKey('unknown-screen'), 'default')
  assert.equal(helpPageKey('help'), 'help')
})
