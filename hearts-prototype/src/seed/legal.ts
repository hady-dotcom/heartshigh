import { ensureLegalPages, grantCurrentConsents, loadPortalContacts } from '@/server/consent'
import { portalIdOf } from '@/lib/ids'

type Payload = Parameters<typeof ensureLegalPages>[0]

export async function grantAllLearnerConsents(payload: Payload) {
  const people = await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 500 })
  for (const person of people.docs as { id: number; role?: string; tenants?: { tenant?: unknown }[] }[]) {
    if (person.role !== 'learner') continue
    const portalId = portalIdOf(person as never)
    if (!portalId) continue
    await grantCurrentConsents(payload, person.id, portalId)
  }
}

export async function seedLegal(payload: Payload) {
  await ensureLegalPages(payload)
  await grantAllLearnerConsents(payload)
  const portals = await payload.find({ collection: 'portals', overrideAccess: true, depth: 0, limit: 50 })
  for (const portal of portals.docs as { id: number; name?: string }[]) {
    const have = await loadPortalContacts(payload, portal.id)
    if (have) continue
    await payload.create({
      collection: 'portal-contacts',
      overrideAccess: true,
      data: {
        portal: portal.id,
        privacyName: 'Privacy desk',
        privacyEmail: 'privacy@hearts.test',
        safeguardingName: 'Safeguarding lead',
        safeguardingEmail: 'safeguarding@hearts.test',
        safeguardingPhone: '020 0000 0000',
        schoolOfflineConsent: false,
      } as never,
    })
  }
}
