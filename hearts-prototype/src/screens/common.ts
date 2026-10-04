import type { CollectionSlug, Payload, Where } from 'payload'
import { idOf } from '@/lib/ids'
import type { PortalDoc, SessionUser } from '@/server/context'

export type Query = {
  error?: string
  notice?: string
  step?: string
  lane?: string
  part?: string
  t?: string
  answer?: string
  course?: string
  filter?: string
  kind?: string
  group?: string
  item?: string
  view?: string
  door?: string
  speaker?: string
  context?: string
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

export async function rows(payload: Payload, collection: string, where?: Where, options: { limit?: number; sort?: string; depth?: number } = {}) {
  const found = await payload.find({
    collection: collection as CollectionSlug,
    overrideAccess: true,
    depth: options.depth ?? 0,
    limit: options.limit ?? 300,
    sort: options.sort,
    where,
  })
  return found.docs as unknown as Row[]
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
  return match ? `https://www.youtube-nocookie.com/embed/${match[1]}` : value
}

export async function unreadCount(payload: Payload, user: SessionUser) {
  const notes = await rows(payload, 'notifications', { user: { equals: user.id } }, { limit: 200 })
  return notes.filter((note) => note.read !== true && note.channel !== 'email-stub').length
}

export async function portalPeople(payload: Payload, portalId: number) {
  return rows(payload, 'users', { 'tenants.tenant': { equals: portalId } }, { limit: 500, sort: 'name' })
}

export function isStaff(user: SessionUser) {
  return user.role !== 'learner'
}
