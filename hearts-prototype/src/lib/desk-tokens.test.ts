import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { contrastRatio, deskTokens } from './desk-tokens'

test('desk tokens are the white canvas and blue accent', () => {
  assert.equal(deskTokens.page, '#F2F2F7')
  assert.equal(deskTokens.card, '#FFFFFF')
  assert.equal(deskTokens.ink, '#111827')
  assert.equal(deskTokens.heading, '#111827')
  assert.equal(deskTokens.gold, '#2563EB')
  assert.equal(deskTokens.muted, '#4B5563')
  assert.equal(deskTokens.line, '#E5E7EB')
  assert.equal(deskTokens.field, '#F3F4F6')
  assert.notEqual(deskTokens.page.toLowerCase(), '#0e2a2b')
  const css = readFileSync(new URL('../app/(frontend)/theme.css', import.meta.url), 'utf8')
  const desk = readFileSync(new URL('../app/(frontend)/desk.css', import.meta.url), 'utf8')
  for (const value of Object.values(deskTokens)) assert.match(css, new RegExp(value))
  assert.match(desk, /--paper:\s*var\(--desk-page/)
  assert.match(desk, /--card:\s*var\(--desk-card/)
  assert.match(desk, /--gold:\s*var\(--desk-gold/)
})

test('desk type on white panels meets 4.5:1', () => {
  assert.ok(contrastRatio(deskTokens.ink, deskTokens.page) >= 4.5)
  assert.ok(contrastRatio(deskTokens.ink, deskTokens.card) >= 4.5)
  assert.ok(contrastRatio(deskTokens.heading, deskTokens.page) >= 4.5)
  assert.ok(contrastRatio(deskTokens.muted, deskTokens.card) >= 4.5)
  assert.ok(contrastRatio(deskTokens.muted, deskTokens.page) >= 4.5)
  assert.ok(contrastRatio(deskTokens.onDark, deskTokens.header) >= 4.5)
  assert.ok(contrastRatio(deskTokens.goldInk, deskTokens.gold) >= 4.5)
})
