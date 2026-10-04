import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { contrastRatio, deskTokens } from './desk-tokens'

test('desk tokens are the evening-garden teal, gold and cream values', () => {
  assert.equal(deskTokens.page, '#0E2A2B')
  assert.equal(deskTokens.card, '#163633')
  assert.equal(deskTokens.ink, '#F6EEDC')
  assert.equal(deskTokens.heading, '#F6EEDC')
  assert.equal(deskTokens.gold, '#D4A84B')
  assert.equal(deskTokens.muted, '#E4D3A4')
  assert.equal(deskTokens.line, '#C4923A')
  assert.equal(deskTokens.field, '#102E2C')
  assert.notEqual(deskTokens.page.toLowerCase(), '#efe3c8')
  const css = readFileSync(new URL('../app/(frontend)/theme.css', import.meta.url), 'utf8')
  const desk = readFileSync(new URL('../app/(frontend)/desk.css', import.meta.url), 'utf8')
  for (const value of Object.values(deskTokens)) assert.match(css, new RegExp(value))
  assert.match(desk, /--paper:\s*var\(--desk-page/)
  assert.match(desk, /--card:\s*var\(--desk-card/)
  assert.match(desk, /--gold:\s*var\(--desk-gold/)
})

test('desk type on teal panels meets 4.5:1', () => {
  assert.ok(contrastRatio(deskTokens.ink, deskTokens.page) >= 4.5)
  assert.ok(contrastRatio(deskTokens.ink, deskTokens.card) >= 4.5)
  assert.ok(contrastRatio(deskTokens.heading, deskTokens.page) >= 4.5)
  assert.ok(contrastRatio(deskTokens.muted, deskTokens.card) >= 4.5)
  assert.ok(contrastRatio(deskTokens.muted, deskTokens.page) >= 4.5)
  assert.ok(contrastRatio(deskTokens.onDark, deskTokens.header) >= 4.5)
  assert.ok(contrastRatio(deskTokens.goldInk, deskTokens.gold) >= 4.5)
})
