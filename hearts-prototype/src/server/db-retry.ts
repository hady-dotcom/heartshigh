const TRANSIENT = /connection terminated|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|too many clients|remaining connection slots|timeout exceeded|connection refused|sorry, too many clients|client has encountered a connection error|canceling statement due to statement timeout|deadlock detected|could not serialize|database system is (?:starting up|shutting down|in recovery)|SSL connection has been closed|socket hang up|57P01|57P02|57P03|08006|08001|08003|08004|53300|40001|40P01|57014/i

function errorText(error: unknown) {
  if (typeof error === 'string') return error
  if (!error || typeof error !== 'object') return ''
  const row = error as { message?: unknown; code?: unknown }
  return [row.code, row.message].filter((part) => typeof part === 'string').join(' ')
}

/** A dropped or busy Postgres session. The same read usually works a moment later. */
export function isTransientDbError(error: unknown) {
  const queue: unknown[] = [error]
  const seen = new Set<unknown>()
  while (queue.length) {
    const current = queue.shift()
    if (!current || seen.has(current)) continue
    seen.add(current)
    if (TRANSIENT.test(errorText(current))) return true
    if (typeof current === 'object') {
      const row = current as { cause?: unknown; errors?: unknown[] }
      if (row.cause) queue.push(row.cause)
      if (Array.isArray(row.errors)) queue.push(...row.errors)
    }
  }
  return false
}

/** One quiet retry. A second failure is a real outage and still throws. */
export async function retryRead<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load()
  } catch (error) {
    if (!isTransientDbError(error)) throw error
    await new Promise((resolve) => setTimeout(resolve, 200))
    return await load()
  }
}

/** A shelf on the feed (live, popular talks, a mission) must not blank the films. */
export async function readOr<T>(label: string, load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await retryRead(load)
  } catch (error) {
    console.error(`HEARTS feed could not load ${label}.`, error instanceof Error ? error.message : error)
    return fallback
  }
}
