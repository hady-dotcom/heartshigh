import assert from 'node:assert/strict'
import { test } from 'node:test'
import { TOOL, helpSentenceCount } from '../../src/lib/desk-help'

test('delete tools have calm British help copy', () => {
  for (const key of ['deletePortal', 'deletePerson', 'deleteAccount', 'downloadCopy', 'removeFromPortal']) {
    const text = TOOL[key]
    assert.ok(text, key)
    const count = helpSentenceCount(text)
    assert.ok(count >= 2 && count <= 4, `${key} has ${count} sentences`)
    assert.doesNotMatch(text, /—|–/)
    assert.doesNotMatch(text, /\b(color|favorite|normalize)\b/i)
  }
})
