import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { deskTokens } from './desk-tokens'

test('desk tokens are the evening-garden teal and dark gold', () => {
  assert.equal(deskTokens.page, '#102E2C')
  assert.equal(deskTokens.card, '#163633')
  assert.equal(deskTokens.ink, '#F6EEDC')
  assert.equal(deskTokens.heading, '#F1D58A')
  assert.equal(deskTokens.gold, '#C4923A')
  const css = readFileSync(new URL('../app/(frontend)/theme.css', import.meta.url), 'utf8')
  for (const value of Object.values(deskTokens)) assert.match(css, new RegExp(value))
})
