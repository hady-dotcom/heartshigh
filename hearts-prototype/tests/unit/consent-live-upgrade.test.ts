import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const child = path.join(root, 'scripts/consent-live-upgrade.ts')
const LIVE_URL = process.env.HEARTS_LIVE_DATABASE || 'postgres://hearts:hearts@127.0.0.1:5432/hearts_live'

test('consent migration on a cf40-shaped database asks existing users once', { timeout: 180_000 }, async (t) => {
  const { default: pg } = await import('pg')
  const pool = new pg.Pool({ connectionString: LIVE_URL, connectionTimeoutMillis: 2000 })
  try {
    await pool.query('select 1')
  } catch {
    t.skip('Postgres hearts_live is not available')
    return
  } finally {
    await pool.end().catch(() => undefined)
  }
  const result = spawnSync(process.execPath, ['--import', 'tsx', child], {
    cwd: root,
    encoding: 'utf8',
    timeout: 170_000,
    env: {
      ...process.env,
      NODE_OPTIONS: '',
      DATABASE_URL: LIVE_URL,
      DATABASE_ADAPTER: 'postgres',
      PAYLOAD_SECRET: 'live-upgrade-test-secret-32-characters',
      NODE_ENV: 'test',
    },
  })
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
})
