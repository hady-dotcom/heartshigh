import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const BANNED = /hoopoe|hud-?hud/i
const SKIP = new Set(['node_modules', '.next', 'data', 'tests', 'test-results', 'playwright-report', 'artifacts'])
const TEXT = /\.(tsx?|mjs|js|css|json|md|txt|svg|webmanifest|html)$/

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith('.')) continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

test('no file name, asset, component or line of copy names the hoopoe or Hudhud', () => {
  const files = walk(root)
  const named = files.filter((file) => BANNED.test(path.relative(root, file)))
  assert.deepEqual(named, [])
  const said = files
    .filter((file) => TEXT.test(file) && statSync(file).size < 5_000_000)
    .filter((file) => BANNED.test(readFileSync(file, 'utf8')))
    .map((file) => path.relative(root, file))
  assert.deepEqual(said, [])
})
