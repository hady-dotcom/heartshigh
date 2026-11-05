import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('the registered service worker is a no-op file, so /sw.js is not a 404', () => {
  const source = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8')
  assert.match(source, /addEventListener\('install'/)
  assert.match(source, /addEventListener\('activate'/)
  assert.doesNotMatch(source, /caches/)
})
