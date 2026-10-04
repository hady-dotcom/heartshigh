import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { deskTokens } from './desk-tokens'

test('desk tokens are the shared parchment, ink and teal values', () => {
  assert.equal(deskTokens.page, '#EFE3C8')
  assert.equal(deskTokens.card, '#F7EEDB')
  assert.equal(deskTokens.ink, '#1F2A2A')
  assert.equal(deskTokens.heading, '#0F3B3A')
  const css = readFileSync(new URL('../app/(frontend)/theme.css', import.meta.url), 'utf8')
  for (const value of Object.values(deskTokens)) assert.match(css, new RegExp(value))
})
