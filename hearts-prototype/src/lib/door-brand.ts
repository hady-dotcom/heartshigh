import { getPayload } from 'payload'
import config from '@payload-config'
import { portalLogo } from '@/lib/learner-brand'
import { shellOf } from '@/lib/portal-look'

export function safeNext(value: string | undefined) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

export function nextQuery(next: string) {
  return next && next !== '/' ? `?next=${encodeURIComponent(next)}` : ''
}

const DOOR_SLUG = /^[a-z0-9-]{1,80}$/i

/** The portal in ?next=, or the one this browser last opened when the address has none. */
export function rememberedDoor(next: string, remembered?: string | null) {
  const fromNext = next.match(/^\/p\/([^/?#]+)/)?.[1] || ''
  if (fromNext) return { slug: fromNext, explicit: true }
  const saved = String(remembered || '').trim()
  if (DOOR_SLUG.test(saved)) return { slug: saved, explicit: false }
  return { slug: '', explicit: false }
}

export type DoorBrand = { name: string; logo: string; home: string }

const EMPTY_DOOR: DoorBrand = { name: '', logo: '', home: '' }

/** Sign-in, reset and the access code. A remembered portal is used only when its shell is the white one, so a HEARTS visit to /login stays HEARTS. */
export async function brandForDoor(next: string, remembered?: string | null): Promise<DoorBrand> {
  const picked = rememberedDoor(next, remembered)
  if (!picked.slug) return EMPTY_DOOR
  try {
    const payload = await getPayload({ config })
    const found = await payload.find({ collection: 'portals', overrideAccess: true, depth: 0, limit: 1, where: { slug: { equals: picked.slug } } })
    const portal = found.docs[0] as { brandName?: string | null; logoUrl?: string | null; shell?: string | null } | undefined
    if (!portal) return EMPTY_DOOR
    if (!picked.explicit && shellOf(portal) !== 'modern') return EMPTY_DOOR
    const name = String(portal.brandName || '').trim()
    if (!name) return EMPTY_DOOR
    return { name, logo: portalLogo(portal.logoUrl), home: `/p/${picked.slug}` }
  } catch {
    return EMPTY_DOOR
  }
}

/** The portal named in ?next=, so sign-in, reset and the access code use that door. */
export async function brandForNext(next: string) {
  const door = await brandForDoor(next)
  return { name: door.name, logo: door.logo }
}
