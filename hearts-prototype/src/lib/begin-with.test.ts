import assert from 'node:assert/strict'
import { test } from 'node:test'
import { beginWith } from './begin-with'
import { freshState } from './heart'
import { SCENES } from './opening-data'

test('door and account taps name the first talk in plain words', () => {
  const at = Date.UTC(2026, 9, 4)
  const empty = freshState('east-london', 1, at)
  assert.equal(beginWith(empty, SCENES).title, 'a calm place to start')
  const door = { ...empty, taps: [{ scene: 'doors', option: 'calmer', at }] }
  assert.equal(beginWith(door, SCENES).title, 'a calmer heart')
  const account = { ...empty, taps: [{ scene: 'account', option: 'lord', at }] }
  assert.equal(beginWith(account, SCENES).title, 'Allah as Lord')
})
