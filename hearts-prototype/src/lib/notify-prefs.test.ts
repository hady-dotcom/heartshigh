import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { kindFromKey, notifyKey, parsePrefs, wantsEmail } from './notify-prefs'

describe('notification preferences', () => {
  it('defaults weekly to off and migrates night alerts', () => {
    const fresh = parsePrefs(null)
    assert.equal(fresh.channels.weekly, 'off')
    assert.equal(fresh.channels['teacher-reply'], 'in-app')
    const migrated = parsePrefs(null, true)
    assert.equal(migrated.channels['gather-tomorrow'], 'in-app')
  })

  it('reads a stored channel and builds a kind key', () => {
    const prefs = parsePrefs({ channels: { 'teacher-reply': 'email' }, quietNight: false })
    assert.equal(wantsEmail(prefs, 'teacher-reply'), true)
    assert.equal(kindFromKey(notifyKey('live-soon', '12')), 'live-soon')
  })
})
