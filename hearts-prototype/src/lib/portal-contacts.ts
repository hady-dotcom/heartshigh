/**
 * P11 contacts live on Lane B's `portal-contacts` collection.
 * This accessor reads that collection when it is registered; otherwise it falls
 * back to Portals.notificationEmails so Care and safety still has someone to tell.
 * Integrator: swap the fallback once Lane B merges.
 */

import type { Payload } from 'payload'

export type PortalContact = {
  name: string
  email: string
  phone?: string
  kind: 'privacy' | 'safeguarding'
  source: 'portal-contacts' | 'notification-emails' | 'none'
}

export function parseNotificationEmails(raw: unknown): { name: string; email: string }[] {
  const text = String(raw || '')
  const found = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []
  return found.map((email) => ({ name: email.split('@')[0], email }))
}

export async function readPortalContacts(payload: Payload, portalId: number): Promise<{ privacy: PortalContact | null; safeguarding: PortalContact | null }> {
  const empty = { privacy: null as PortalContact | null, safeguarding: null as PortalContact | null }
  if (!portalId) return empty
  const hasContacts = payload.collections && 'portal-contacts' in payload.collections
  if (hasContacts) {
    try {
      const found = await payload.find({
        collection: 'portal-contacts' as never,
        overrideAccess: true,
        depth: 0,
        limit: 10,
        where: { portal: { equals: portalId } },
      })
      const rows = found.docs as { kind?: string; name?: string; email?: string; phone?: string }[]
      const pick = (kind: 'privacy' | 'safeguarding'): PortalContact | null => {
        const row = rows.find((item) => item.kind === kind && item.email)
        return row ? { name: row.name || row.email || '', email: row.email || '', phone: row.phone, kind, source: 'portal-contacts' } : null
      }
      return { privacy: pick('privacy'), safeguarding: pick('safeguarding') }
    } catch {
      // Collection registered but empty or not migrated yet.
    }
  }
  const portal = await payload.findByID({ collection: 'portals', id: portalId, overrideAccess: true, depth: 0 }).catch(() => null)
  const emails = parseNotificationEmails((portal as { notificationEmails?: string } | null)?.notificationEmails)
  if (!emails[0]) return empty
  const fallback: PortalContact = { name: emails[0].name, email: emails[0].email, kind: 'safeguarding', source: 'notification-emails' }
  return { privacy: { ...fallback, kind: 'privacy' }, safeguarding: fallback }
}

export async function safeguardingLead(payload: Payload, portalId: number) {
  return (await readPortalContacts(payload, portalId)).safeguarding
}
