/** One JSON line on stderr. The message and stack are included. Request bodies and cookies are not. */
export function logError(event: string, error: unknown, extra?: Record<string, unknown>) {
  const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown error')
  console.error(JSON.stringify({ time: new Date().toISOString(), level: 'error', event, message: err.message, stack: err.stack, ...extra }))
}
