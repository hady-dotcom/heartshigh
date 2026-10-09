import type { Payload } from 'payload'
import { imageUrl, speakerSlug } from '@/lib/speakers'
import { portraitFor } from '@/server/learner'

export type SpeakerPage = {
  slug: string
  name: string
  displayName: string
  honorific: string
  bio: string
  sources: string
  portrait: string | null
  links: { label: string; url: string }[]
  aliasSlugs: string[]
}

type SpeakerDoc = {
  slug?: string | null
  name?: string | null
  displayName?: string | null
  honorific?: string | null
  bio?: string | null
  sources?: string | null
  photoUrl?: string | null
  photo?: { url?: string | null; filename?: string | null } | number | null
  links?: unknown
  aliases?: unknown
}

function linksOf(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as { label?: unknown; url?: unknown }
    const url = String(row.url || '')
    if (!url.startsWith('https://')) return []
    return [{ label: String(row.label || 'Link'), url }]
  })
}

function aliasesOf(value: unknown) {
  return Array.isArray(value) ? value.map(String) : []
}

/** The speaker record for a page address, including an alias that used to be its own page. */
export async function speakerPage(payload: Payload, slug: string): Promise<SpeakerPage | null> {
  const found = await payload.find({ collection: 'speakers', overrideAccess: true, depth: 1, limit: 200 })
  const doc = (found.docs as SpeakerDoc[]).find((speaker) => {
    const aliases = aliasesOf(speaker.aliases)
    const addresses = [speaker.slug, speaker.name, speaker.displayName, ...aliases].map((value) => speakerSlug(String(value || ''))).filter(Boolean)
    return addresses.includes(slug) || speaker.slug === slug
  })
  if (!doc?.slug || !doc.name) return null
  const photo = doc.photo && typeof doc.photo === 'object' ? doc.photo.url || (doc.photo.filename ? `/api/media/file/${doc.photo.filename}` : null) : null
  const portrait = photo || imageUrl(doc.photoUrl) || portraitFor(doc.slug)
  const links = linksOf(doc.links)
  if (doc.photoUrl && !imageUrl(doc.photoUrl) && doc.photoUrl.startsWith('https://') && !links.some((link) => link.url === doc.photoUrl)) {
    links.push({ label: 'Photo', url: doc.photoUrl })
  }
  return {
    slug: doc.slug,
    name: doc.name,
    displayName: doc.displayName || doc.name,
    honorific: doc.honorific || '',
    bio: doc.bio || '',
    sources: doc.sources || '',
    portrait,
    links,
    aliasSlugs: aliasesOf(doc.aliases).map((alias) => speakerSlug(alias)).filter(Boolean),
  }
}
