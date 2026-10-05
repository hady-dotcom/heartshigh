import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

test('the demo seed never plants the fake Ten sittings course', () => {
  const dir = path.join(process.cwd(), 'src/seed')
  for (const name of readdirSync(dir)) {
    if (!/\.(ts|js)$/.test(name)) continue
    const text = readFileSync(path.join(dir, name), 'utf8')
    assert.doesNotMatch(text, /Ten sittings/, name)
    assert.doesNotMatch(text, /xxTESTFAKEid/, name)
  }
})
