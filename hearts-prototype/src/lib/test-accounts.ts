/** Test and audit accounts that clutter Teach, Compass, Plans and Access. Never delete them; hide them. */

const KEEP_EMAILS = new Set(['demo-learner@hearts.foundation', 'demo-complete@hearts.foundation', 'walkthrough@hearts.foundation'])

/** Local-part prefixes used by audit and QA bots. */
const HIDE_LOCAL = /^(ux-audit-|qa-|demo-|words-audit|compass-\d+)/i

export function isTestAccount(email?: string | null, name?: string | null) {
  const address = String(email || '').trim().toLowerCase()
  const label = String(name || '').trim()
  if (!address && !label) return false
  if (KEEP_EMAILS.has(address)) return false
  const local = address.split('@')[0] || ''
  const domain = address.split('@')[1] || ''
  // e2e and demo-portal logins live on these domains and must stay on Teach.
  if (domain === 'hearts.test' || domain === 'hearts-demo.test') return false
  if (HIDE_LOCAL.test(local)) return true
  if (domain === 'hearts.foundation' && /(audit|ux-|qa-)/i.test(address)) return true
  if (/^test\b/i.test(label)) return true
  if (/^ux audit\b/i.test(label) || /^words audit\b/i.test(label)) return true
  return false
}

/** On by default. `?hideTest=0` or `?showTest=1` shows them. */
export function hideTestFromQuery(query: { hideTest?: string; showTest?: string } | Record<string, string | undefined>) {
  if (query.showTest === '1') return false
  return query.hideTest !== '0'
}

export function visiblePeople<T extends { id?: number; email?: string | null; name?: string | null }>(people: T[], hide: boolean): T[] {
  return hide ? people.filter((person) => !isTestAccount(person.email, person.name)) : people
}
