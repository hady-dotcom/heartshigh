import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const root = path.resolve(import.meta.dirname, '../..')

test('auth screens use the apple door, and the 240 baselines are still the visual suite', () => {
  const auth = [
    'src/app/(frontend)/login/page.tsx',
    'src/app/(frontend)/forgot/page.tsx',
    'src/app/(frontend)/join/page.tsx',
    'src/app/(frontend)/reset/page.tsx',
    'src/app/(frontend)/change-password/page.tsx',
    'src/app/(frontend)/page.tsx',
  ]
  for (const file of auth) {
    const source = readFileSync(path.join(root, file), 'utf8')
    assert.match(source, /apple-door/, file)
    assert.doesNotMatch(source, /garden-door|hady-door/, file)
  }
  const theme = readFileSync(path.join(root, 'src/app/(frontend)/theme.css'), 'utf8')
  const start = theme.indexOf('apple-door-start')
  const end = theme.indexOf('apple-door-end')
  const block = theme.slice(start, end)
  assert.ok(block.length > 100)
  assert.doesNotMatch(block, /#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(/)
  const shots = readdirSync(path.join(root, 'tests/e2e/visual-qa.spec.ts-snapshots')).filter((name) => name.endsWith('.png'))
  assert.ok(shots.length >= 240, `expected the visual suite to cover 240 baselines, found ${shots.length}`)
  assert.ok(shots.some((name) => name.startsWith('hady-')))
  assert.ok(shots.some((name) => name.startsWith('hearts-')))
})
