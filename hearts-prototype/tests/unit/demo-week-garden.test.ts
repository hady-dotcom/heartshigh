import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { demoWeekGardenGuard } from '../../src/lib/demo-week'

test('the afternoon walk helper refuses production and remote databases', () => {
  assert.match(demoWeekGardenGuard({ NODE_ENV: 'production', DATABASE_URL: 'file:./data/hearts.db' }) || '', /production/)
  assert.match(demoWeekGardenGuard({ NODE_ENV: 'test', DATABASE_URL: 'postgres://db.example.com/hearts' }) || '', /remote/)
  assert.equal(demoWeekGardenGuard({ NODE_ENV: 'test', DATABASE_URL: 'file:./data/hearts.db' }), null)
})

test('the afternoon walk seed adds a named plan and never wipes the portal', () => {
  const text = readFileSync(path.join(process.cwd(), 'src/seed/demo-week-garden.ts'), 'utf8')
  assert.match(text, /AFTERNOON_PLAN/)
  assert.match(text, /Adds only/)
  assert.match(text, /demoGardenAt/)
  assert.match(text, /harvest-entries/)
  assert.match(text, /seat-visits/)
  assert.match(text, /rituals/)
  assert.doesNotMatch(text, /payload\.delete/)
  assert.doesNotMatch(text, /--reset/)
  assert.doesNotMatch(text, /DROP SCHEMA/)
})
