import type { CollectionSlug, Payload, Where } from 'payload'
import { idOf } from '@/lib/ids'
import { learnerEmbedSrc } from '@/lib/yt'
import type { PortalDoc, SessionUser } from '@/server/context'

export type Query = {
  error?: string
  notice?: string
  step?: string
  lane?: string
  part?: string
  t?: string
  answer?: string
  /** Reply queue: unanswered, all, or answered. */
  queue?: string
  /** Reply queue portal slug, or `all`. */
  queuePortal?: string
  course?: string
  start?: string
  end?: string
  days?: string
  minutes?: string
  filter?: string
  kind?: string
  group?: string
  item?: string
  view?: string
  door?: string
  seat?: string
  /** Library: the pack opened below the packs. */
  pack?: string
  talk?: string
  question?: string
  family?: string
  learner?: string
  from?: string
  to?: string
  cohort?: string
  anonymise?: string
  filters?: string
  named?: string
  speaker?: string
  context?: string
  /** Garden painting: `dawn` or `evening`. Another theme pass can set this. */
  theme?: string
  hideTest?: string
  showTest?: string
  origin?: string
  q?: string
  /** Learner list: a portal id, or empty for every portal. */
  portal?: string
  /** A code just made from a quick link, so the desk can show the address, WhatsApp and QR. */
  fresh?: string
  /** `?debug=yt` — kept when moving between course links. */
  debug?: string
  /** `1` pauses a sequenced film at the end of its kinetic clip. */
  clip?: string
  /** Library list page. */
  page?: string
  /** Course film-card page. */
  films?: string
  /** Library and Review: `too-short` lists talks hidden for being under five minutes. */
  show?: string
}

export type Ctx = {
  payload: Payload
  user: SessionUser
  portal: PortalDoc
  slug: string
  base: string
  origin: string
  query: Query
}

export type Row = Record<string, unknown> & { id: number; createdAt?: string }

/** Page size used when a caller does not ask for a page. Do not treat this as the size of the library. */
export const ROW_PAGE = 300

/** Library lists are built for about this many courses, films or clips, one page at a time. */
export const CATALOGUE_CEILING = 6000

export function pageCount(total: number, size: number) {
  if (total <= 0 || size <= 0) return 1
  return Math.ceil(total / size)
}

export function clampPage(raw: string | number | undefined, pages: number) {
  const value = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(value) || value < 1) return 1
  return Math.min(Math.floor(value), Math.max(1, pages))
}

export async function countDocs(payload: Payload, collection: string, where?: Where) {
  const found = await payload.count({
    collection: collection as CollectionSlug,
    overrideAccess: true,
    where,
  })
  return found.totalDocs
}

export async function pageDocs(
  payload: Payload,
  collection: string,
  where: Where | undefined,
  options: { page: number; limit: number; sort?: string; depth?: number },
) {
  const limit = Math.max(1, options.limit)
  const page = Math.max(1, Math.floor(options.page) || 1)
  const found = await payload.find({
    collection: collection as CollectionSlug,
    overrideAccess: true,
    depth: options.depth ?? 0,
    limit,
    page,
    sort: options.sort,
    where,
  })
  const total = found.totalDocs
  return {
    docs: found.docs as unknown as Row[],
    total,
    page: found.page || page,
    pages: pageCount(total, limit),
  }
}

/** Every matching row, fetched in pages, so a list is not cut off at 300. Stops at CATALOGUE_CEILING. */
export async function allDocs(
  payload: Payload,
  collection: string,
  where?: Where,
  options: { sort?: string; depth?: number; pageSize?: number; max?: number } = {},
) {
  const pageSize = options.pageSize ?? 200
  const max = options.max ?? CATALOGUE_CEILING
  const docs: Row[] = []
  let page = 1
  for (;;) {
    const found = await pageDocs(payload, collection, where, { page, limit: pageSize, sort: options.sort, depth: options.depth })
    docs.push(...found.docs)
    if (!found.docs.length || docs.length >= found.total || docs.length >= max || page >= found.pages) break
    page += 1
  }
  return docs.slice(0, max)
}

export async function rows(payload: Payload, collection: string, where?: Where, options: { limit?: number; sort?: string; depth?: number } = {}) {
  const found = await pageDocs(payload, collection, where, {
    page: 1,
    limit: options.limit ?? ROW_PAGE,
    sort: options.sort,
    depth: options.depth,
  })
  return found.docs
}

export async function one(payload: Payload, collection: string, id: number | null | undefined) {
  if (!id || !Number.isFinite(id)) return null
  try {
    return (await payload.findByID({ collection: collection as CollectionSlug, id, overrideAccess: true, depth: 0 })) as unknown as Row
  } catch {
    return null
  }
}

export const str = (value: unknown, fallback = '') => (typeof value === 'string' ? value : value == null ? fallback : String(value))
export const ref = (value: unknown) => idOf(value)

export function clock(total: number) {
  const value = Math.max(0, Math.floor(total))
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const seconds = value % 60
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function shortDate(iso: string | undefined | null) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export function longDate(iso: string | undefined | null) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
}

export function embedUrl(value: string) {
  const match = value.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/)
  return match ? learnerEmbedSrc(match[1]) : value
}

export async function unreadCount(payload: Payload, user: SessionUser) {
  const notes = await rows(payload, 'notifications', { user: { equals: user.id } }, { limit: 200 })
  return notes.filter((note) => note.read !== true && note.channel !== 'email-stub' && note.channel !== 'think').length
}

export async function portalPeople(payload: Payload, portalId: number) {
  return rows(payload, 'users', { 'tenants.tenant': { equals: portalId } }, { limit: 500, sort: 'name' })
}

export function isStaff(user: SessionUser) {
  return user.role !== 'learner'
}
