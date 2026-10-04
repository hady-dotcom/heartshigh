import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { contrastRatio, deskTokens } from './desk-tokens'

test('desk tokens are PR #24 evening-garden teal and warm gold', () => {
  assert.equal(deskTokens.page, '#0E2A2B')
  assert.equal(deskTokens.card, '#163633')
  assert.equal(deskTokens.ink, '#F6EEDC')
  assert.equal(deskTokens.heading, '#F6EEDC')
  assert.equal(deskTokens.gold, '#D4A84B')
  assert.equal(deskTokens.muted, '#E4D3A4')
  assert.equal(deskTokens.line, '#C4923A')
  assert.equal(deskTokens.field, '#102E2C')
  const theme = readFileSync(new URL('../app/(frontend)/theme.css', import.meta.url), 'utf8')
  const desk = readFileSync(new URL('../app/(frontend)/desk.css', import.meta.url), 'utf8')
  for (const value of Object.values(deskTokens)) assert.match(theme, new RegExp(value))
  assert.match(desk, /--paper:\s*var\(--desk-page/)
  assert.match(desk, /--gold:\s*var\(--desk-gold/)
  assert.match(desk, /#0E2A2B/)
  assert.match(desk, /#D4A84B/)
  assert.ok(contrastRatio(deskTokens.ink, deskTokens.page) >= 4.5)
})
