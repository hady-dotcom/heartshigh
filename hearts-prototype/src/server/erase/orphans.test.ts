import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

describe('db:orphans stays read-only on an older schema', () => {
  const source = readFileSync(path.join(here, 'orphans.ts'), 'utf8')

  it('does not create tables or write rows while reporting', () => {
    assert.doesNotMatch(source, /ensureRetryTable/)
    assert.doesNotMatch(source, /CREATE TABLE/i)
    assert.doesNotMatch(source, /INSERT INTO/i)
    assert.doesNotMatch(source, /UPDATE /)
    assert.match(source, /tableExists/)
  })

  it('skips a table that is not in the database so later PRs can add their own', () => {
    assert.match(source, /if \(!\(await tableExists/)
    assert.match(source, /erase_s3_retries/)
  })
})
