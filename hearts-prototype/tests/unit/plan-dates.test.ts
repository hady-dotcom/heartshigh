import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('From and Until use the same field box as Name and Course', () => {
  const css = readFileSync(new URL('../../src/app/(frontend)/app.css', import.meta.url), 'utf8')
  const ruleAt = css.indexOf('.plan-form .date-field {')
  const rule = css.slice(ruleAt, css.indexOf('.plan-form .date-field::-webkit-date-and-time-value', ruleAt))
  assert.ok(ruleAt > 0)
  assert.match(rule, /display:\s*block/)
  assert.match(rule, /width:\s*100%/)
  assert.match(rule, /max-width:\s*100%/)
  assert.match(rule, /min-width:\s*0/)
  assert.match(rule, /box-sizing:\s*border-box/)
  assert.match(rule, /-webkit-appearance:\s*none/)
  assert.match(rule, /text-align:\s*left/)
  const value = css.slice(css.indexOf('.plan-form .date-field::-webkit-date-and-time-value'), css.indexOf('.plan-form .date-field::-webkit-datetime-edit'))
  assert.match(value, /text-align:\s*left/)
  const source = readFileSync(new URL('../../src/components/app/plan-form.tsx', import.meta.url), 'utf8')
  assert.match(source, /className="field date-field"[^>]*data-testid="schedule-start"/)
  assert.match(source, /className="field date-field"[^>]*data-testid="schedule-end"/)
})
