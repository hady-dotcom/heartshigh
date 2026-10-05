import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

describe('D03 backup docs', () => {
  it('tells Leon how to cron Postgres and S3 without putting secrets in the repo', () => {
    const text = readFileSync(path.join(process.cwd(), 'docs/BACKUPS.md'), 'utf8')
    assert.match(text, /pg_dump --format=custom/)
    assert.match(text, /AGE_RECIPIENT/)
    assert.match(text, /BACKUP_BUCKET/)
    assert.match(text, /14 days/)
    assert.match(text, /s3 sync/i)
    assert.doesNotMatch(text, /AKIA[A-Z0-9]{16}/)
    assert.doesNotMatch(text, /age1[a-z0-9]{20,}/)
  })
})
