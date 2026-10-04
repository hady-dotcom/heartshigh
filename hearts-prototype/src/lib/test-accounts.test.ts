import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { hideTestFromQuery, isTestAccount, visiblePeople } from './test-accounts'

describe('isTestAccount', () => {
  it('hides audit, qa and demo emails, and names that start with Test', () => {
    assert.equal(isTestAccount('ux-audit-first-493be006@hearts.foundation', 'Amina Test'), true)
    assert.equal(isTestAccount('qa-portal-admin-1791041759507@hearts.foundation', 'Test Portal Admin'), true)
    assert.equal(isTestAccount('demo-imam@hearts.foundation', 'Imam Sami El-Masri'), true)
    assert.equal(isTestAccount('words-audit@hearts.foundation', 'Words Audit'), true)
    assert.equal(isTestAccount('someone@masjid.org', 'Test Learner'), true)
    assert.equal(isTestAccount('play@hearts.foundation', 'UX Audit Play 2143cb'), true)
    assert.equal(isTestAccount('qa-desk@hearts.foundation', 'QA Desk Learner'), true)
  })

  it('keeps the two demo learners and ordinary accounts, including e2e logins', () => {
    assert.equal(isTestAccount('demo-learner@hearts.foundation', 'Amina Yusuf'), false)
    assert.equal(isTestAccount('demo-complete@hearts.foundation', 'Yusuf Rahman'), false)
    assert.equal(isTestAccount('elm-learner@hearts.test', 'Maryam'), false)
    assert.equal(isTestAccount('demo-admin@hearts-demo.test', 'Nabil Hassan (demo)'), false)
    assert.equal(isTestAccount('layla@hearts-demo.test', 'Layla Rahman (demo)'), false)
    assert.equal(isTestAccount('imam@masjid.org', 'Imam Karim'), false)
  })
})

describe('hideTestFromQuery', () => {
  it('is on by default and off when asked', () => {
    assert.equal(hideTestFromQuery({}), true)
    assert.equal(hideTestFromQuery({ hideTest: '1' }), true)
    assert.equal(hideTestFromQuery({ hideTest: '0' }), false)
    assert.equal(hideTestFromQuery({ showTest: '1' }), false)
  })
})

describe('visiblePeople', () => {
  it('filters only when hide is on', () => {
    const people = [
      { email: 'imam@masjid.org', name: 'Imam Karim' },
      { email: 'qa-bot@hearts.foundation', name: 'QA Bot' },
      { email: 'demo-learner@hearts.foundation', name: 'Amina Yusuf' },
    ]
    assert.equal(visiblePeople(people, true).length, 2)
    assert.equal(visiblePeople(people, false).length, 3)
  })
})
