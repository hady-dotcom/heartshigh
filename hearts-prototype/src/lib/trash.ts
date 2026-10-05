import { now } from './clock'

/** C15: content sits here for 30 days, then a job empties it. People and answers never do. */
export const TRASH_KEEP_DAYS = 30

export type TrashCollection = {
  slug: string
  label: string
  titleFields: string[]
  portalField?: 'portal'
  via?: 'course' | 'lesson'
  optional?: boolean
}

export const TRASH_COLLECTIONS: TrashCollection[] = [
  { slug: 'courses', label: 'Courses', titleFields: ['title'], portalField: 'portal' },
  { slug: 'units', label: 'Topics', titleFields: ['title'], via: 'course' },
  { slug: 'lessons', label: 'Talks', titleFields: ['title'], portalField: 'portal', via: 'course' },
  { slug: 'engagement-points', label: 'Questions', titleFields: ['prompt'], via: 'lesson' },
  { slug: 'circle-answers', label: 'Circle answers', titleFields: ['name'], portalField: 'portal' },
  { slug: 'access-codes', label: 'Access codes', titleFields: ['label', 'code'], portalField: 'portal' },
  { slug: 'packs', label: 'Course packs', titleFields: ['title'], portalField: 'portal' },
  { slug: 'announcements', label: 'Announcements', titleFields: ['title', 'body'], portalField: 'portal', optional: true },
]

export const TRASH_SLUGS = TRASH_COLLECTIONS.map((row) => row.slug)

export function isTrashCollection(slug: string) {
  return TRASH_SLUGS.includes(slug)
}

export function trashCollection(slug: string) {
  return TRASH_COLLECTIONS.find((row) => row.slug === slug) || null
}

export function trashLabel(slug: string) {
  return trashCollection(slug)?.label || slug
}

export function trashTitle(doc: Record<string, unknown>, slug: string) {
  const fields = trashCollection(slug)?.titleFields || ['title', 'name']
  for (const field of fields) {
    const value = String(doc[field] || '').trim()
    if (value) return value.length > 80 ? `${value.slice(0, 77)}…` : value
  }
  return `${trashLabel(slug)} ${doc.id || ''}`.trim()
}

export function trashCutoff(when: Date = now()) {
  return new Date(when.getTime() - TRASH_KEEP_DAYS * 86_400_000)
}

export function isExpiredTrash(deletedAt: string | Date | null | undefined, when: Date = now()) {
  if (!deletedAt) return false
  const at = deletedAt instanceof Date ? deletedAt : new Date(deletedAt)
  if (Number.isNaN(at.getTime())) return false
  return at.getTime() <= trashCutoff(when).getTime()
}

export function daysLeftInTrash(deletedAt: string | Date | null | undefined, when: Date = now()) {
  if (!deletedAt) return TRASH_KEEP_DAYS
  const at = deletedAt instanceof Date ? deletedAt : new Date(deletedAt)
  if (Number.isNaN(at.getTime())) return TRASH_KEEP_DAYS
  const emptyOn = at.getTime() + TRASH_KEEP_DAYS * 86_400_000
  return Math.max(0, Math.ceil((emptyOn - when.getTime()) / 86_400_000))
}

export type TrashItem = {
  id: number
  collection: string
  title: string
  deletedAt?: string | null
  portalId?: number | null
}

export function groupTrash(items: TrashItem[]) {
  const groups = TRASH_COLLECTIONS.map((row) => {
    const list = items.filter((item) => item.collection === row.slug)
    return { slug: row.slug, label: row.label, count: list.length, items: list }
  }).filter((group) => group.count)
  const known = new Set(TRASH_SLUGS)
  const extra = items.filter((item) => !known.has(item.collection))
  if (extra.length) groups.push({ slug: 'other', label: 'Other', count: extra.length, items: extra })
  return groups
}

export function staffMayUseTrash(role?: string | null) {
  return role === 'master' || role === 'portal-admin'
}
