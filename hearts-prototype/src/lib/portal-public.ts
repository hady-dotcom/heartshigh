/**
 * Fields that must stay on the server. A learner or teacher page must not receive them,
 * even as an encrypted blob. Server code can still read them on the object returned
 * by presentPortal; Object.keys, JSON, and the React client payload omit them.
 */
export const SERVER_ONLY_PORTAL_FIELDS = ['aiConnection', 'notificationEmails'] as const

export function portalForClient<T>(portal: T): T {
  if (!portal || typeof portal !== 'object') return portal
  const copy = { ...(portal as Record<string, unknown>) }
  for (const key of SERVER_ONLY_PORTAL_FIELDS) delete copy[key]
  return copy as T
}

/** Same portal for server code. Secret fields stay readable and are not enumerable. */
export function presentPortal<T extends object>(doc: T): T {
  const record = doc as Record<string, unknown>
  for (const key of SERVER_ONLY_PORTAL_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue
    const value = record[key]
    delete record[key]
    Object.defineProperty(record, key, { value, enumerable: false, writable: true, configurable: true })
  }
  return doc
}
