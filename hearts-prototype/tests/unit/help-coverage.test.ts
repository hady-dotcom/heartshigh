import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PAGE, TEST_IDS, pageHelp } from '../../src/lib/desk-help'
import { LEARNER_HELP, learnerHelp } from '../../src/lib/learner-help'

test('H01 desk pages used in nav have help copy', () => {
  for (const key of ['contacts', 'children', 'legal', 'helpRequests', 'settings', 'teach']) {
    assert.ok(pageHelp(key), key)
    assert.ok(PAGE[key], key)
  }
  assert.equal(pageHelp('contacts', 'admin-contacts'), PAGE.contacts)
  assert.ok(TEST_IDS['admin-children'])
})

test('H01 learner screens used in the app have help copy', () => {
  for (const key of ['home', 'lanes', 'course', 'me', 'settings', 'consent', 'privacy', 'search', 'help', 'feed']) {
    assert.ok(learnerHelp(key) || LEARNER_HELP[key], key)
  }
})
