/**
 * Railway's proxy drops a quiet TCP session. node-postgres will hand that dead
 * session to the next query, and the server component fails once. The reload
 * works because it gets a new session.
 *
 * Keep the sessions we are using alive, and close idle ones on our side before
 * the proxy does.
 */
export function postgresPool(connectionString: string) {
  return {
    connectionString,
    max: 10,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
  }
}
