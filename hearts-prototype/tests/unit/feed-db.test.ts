import assert from 'node:assert/strict'
import { test } from 'node:test'
import { postgresPool } from '../../src/lib/postgres-pool'
import { isTransientDbError, readOr, retryRead } from '../../src/server/db-retry'

test('the postgres pool keeps a live session and drops a quiet one itself', () => {
  const pool = postgresPool('postgres://hearts@127.0.0.1:5432/hearts')
  assert.equal(pool.max, 10)
  assert.equal(pool.keepAlive, true)
  assert.equal(pool.keepAliveInitialDelayMillis, 10_000)
  assert.equal(pool.idleTimeoutMillis, 20_000)
  assert.equal(pool.connectionTimeoutMillis, 10_000)
})

test('a dropped postgres session is transient, a bad query is not', () => {
  assert.equal(isTransientDbError(new Error('Connection terminated unexpectedly')), true)
  assert.equal(isTransientDbError(Object.assign(new Error('fail'), { code: 'ECONNRESET' })), true)
  assert.equal(isTransientDbError(Object.assign(new Error('outer'), { cause: new Error('sorry, too many clients already') })), true)
  assert.equal(isTransientDbError(new Error('column "note" does not exist')), false)
})

test('a transient read is tried once more, then the shelf falls back', async () => {
  let tries = 0
  const value = await retryRead(async () => {
    tries += 1
    if (tries === 1) throw new Error('Connection terminated unexpectedly')
    return 'films'
  })
  assert.equal(value, 'films')
  assert.equal(tries, 2)

  const shelf = await readOr('popular', async () => {
    throw new Error('Connection terminated unexpectedly')
  }, [])
  assert.deepEqual(shelf, [])
})
