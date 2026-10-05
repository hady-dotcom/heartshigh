import type { Payload } from 'payload'
import type { SqlExec } from './types'

type PoolClient = {
  query: (text: string) => Promise<{ rows?: Record<string, unknown>[]; rowCount?: number | null }>
  release: () => void
}

type Pool = { connect: () => Promise<PoolClient> }

function asInt(value: number, label: string) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} is not a valid id.`)
  return value
}

export function bind(text: string, id: number, label = 'id') {
  return text.replaceAll('{id}', String(asInt(id, label)))
}

export function quoteIdent(name: string) {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Bad SQL name: ${name}`)
  return `"${name}"`
}

function rowCount(result: { rows?: unknown[]; rowCount?: number | null; changes?: number }) {
  if (typeof result.rowCount === 'number') return result.rowCount
  if (typeof result.changes === 'number') return result.changes
  return result.rows?.length || 0
}

async function sqliteExec(payload: Payload, text: string) {
  const db = payload.db as {
    drizzle?: {
      run?: (query: unknown) => Promise<{ changes?: number; rows?: Record<string, unknown>[] }>
      all?: (query: unknown) => Promise<Record<string, unknown>[]>
      execute?: (query: unknown) => Promise<{ rows?: Record<string, unknown>[]; rowCount?: number }>
    }
  }
  const drizzle = db.drizzle
  if (!drizzle) throw new Error('This database adapter cannot run a wipe transaction.')
  if (typeof drizzle.execute === 'function') {
    const result = await drizzle.execute(text as never)
    return { rows: (result.rows || []) as Record<string, unknown>[], rowCount: rowCount(result) }
  }
  if (/^\s*select/i.test(text) && typeof drizzle.all === 'function') {
    const rows = await drizzle.all(text as never)
    return { rows, rowCount: rows.length }
  }
  if (typeof drizzle.run === 'function') {
    const result = await drizzle.run(text as never)
    return { rows: (result.rows || []) as Record<string, unknown>[], rowCount: rowCount(result) }
  }
  throw new Error('This database adapter cannot run a wipe transaction.')
}

export async function withEraseTransaction<T>(payload: Payload, work: (exec: SqlExec) => Promise<T>): Promise<T> {
  const pool = (payload.db as { pool?: Pool }).pool
  if (pool) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await work(async (text) => {
        const raw = await client.query(text)
        return { rows: (raw.rows || []) as Record<string, unknown>[], rowCount: rowCount(raw) }
      })
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
  await sqliteExec(payload, 'BEGIN')
  try {
    const result = await work((text) => sqliteExec(payload, text))
    await sqliteExec(payload, 'COMMIT')
    return result
  } catch (error) {
    await sqliteExec(payload, 'ROLLBACK').catch(() => undefined)
    throw error
  }
}

export async function execOutside(payload: Payload, text: string) {
  const pool = (payload.db as { pool?: { query: (text: string) => Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }> } }).pool
  if (pool) {
    const raw = await pool.query(text)
    return { rows: raw.rows || [], rowCount: rowCount(raw) }
  }
  return sqliteExec(payload, text)
}
