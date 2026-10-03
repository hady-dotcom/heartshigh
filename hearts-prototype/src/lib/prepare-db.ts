import { databaseKind, type Env } from './env'

/**
 * Development push writes a marker row (batch -1) so the next migration stops and asks a question.
 * That question says data would be lost. The code behind it does not drop tables, but it does wait for a person
 * to type "yes", which a server cannot do. When the tables are already there, the marker is removed and the
 * migration is recorded against them. Nothing else is deleted.
 */
export async function clearDevPushMarker(env: Env = process.env) {
  if (databaseKind(env) !== 'postgres') return
  const url = env.DATABASE_URL
  if (!url) return
  const { default: pg } = await import('pg')
  const pool = new pg.Pool({ connectionString: url, max: 1 })
  try {
    const tables = await pool.query(`select to_regclass('public.users') as users, to_regclass('public.payload_migrations') as migrations`)
    const row = tables.rows[0] as { users: string | null; migrations: string | null } | undefined
    if (!row?.users || !row.migrations) return
    const removed = await pool.query('delete from payload_migrations where batch = -1')
    if (removed.rowCount) {
      console.log('This database already has the tables. The migration will be recorded against them. Nothing was deleted.')
    }
  } finally {
    await pool.end()
  }
}

/** payload.destroy() sometimes keeps the process open after a push. Give it two seconds, then move on. */
export async function closePayload(payload: { destroy: () => Promise<unknown> }) {
  await Promise.race([payload.destroy().catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 2000))])
}
