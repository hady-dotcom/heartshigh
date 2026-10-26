import { getPayload } from 'payload'
import config from '@payload-config'
import { portalLogo } from '@/lib/learner-brand'

export function safeNext(value: string | undefined) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

export function nextQuery(next: string) {
  return next && next !== '/' ? `?next=${encodeURIComponent(next)}` : ''
}

/** The portal named in ?next=, so sign-in, reset and the access code use that door. */
export async function brandForNext(next: string) {
  const slug = next.match(/^\/p\/([^/?#]+)/)?.[1]
  if (!slug) return { name: '', logo: '' }
  try {
    const payload = await getPayload({ config })
    const found = await payload.find({ collection: 'portals', overrideAccess: true, depth: 0, limit: 1, where: { slug: { equals: slug } } })
    const portal = found.docs[0] as { brandName?: string | null; logoUrl?: string | null } | undefined
    const name = String(portal?.brandName || '').trim()
    if (name) return { name, logo: portalLogo(portal?.logoUrl) }
  } catch {
    // The door still works when the portal lookup misses.
  }
  return { name: '', logo: '' }
}
