import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { GARDEN_AREAS } from '../../src/lib/garden-areas'

test('garden plaques use the learner sans and keep every lane name', () => {
  const css = readFileSync(new URL('../../src/app/(frontend)/garden.css', import.meta.url), 'utf8')
  const rule = css.slice(css.indexOf('.plaque-name {'), css.indexOf('.garden-fruits'))
  assert.match(rule, /font-family:\s*var\(--sans\)/)
  assert.equal(rule.includes('Cinzel'), false)
  assert.equal(rule.includes('text-overflow'), false)
  assert.match(rule, /max-width:\s*36%/)
  assert.match(rule, /white-space:\s*nowrap/)
  assert.match(rule, /left:\s*50\.1%/)
  assert.deepEqual(GARDEN_AREAS.map((area) => area.plaque), ['QUR’AN', 'HADITH', 'CHARACTER', 'SOCIETY', 'SPIRITUALITY'])
})
