/** Plain catalogue numbers and “who can open this course”, with no database. */

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

export const LIBRARY_PAGE_SIZE = 24
export const FILM_PAGE_SIZE = 48

export type LibraryTotals = {
  courses: number
  films: number
  playable: number
  clips: number
}

export type CourseUse = {
  codes: string[]
  packs: string[]
  portals: string[]
}

export type RelationField = {
  name: string
  collections: string[]
  hasMany: boolean
}

export type LinkedDoc = {
  id: number
  label: string
  portalId: number | null
  courseIds: number[]
  packIds: number[]
}

type FieldLike = {
  name?: string
  type?: string
  hasMany?: boolean
  relationTo?: string | string[]
  fields?: FieldLike[]
  tabs?: { fields?: FieldLike[] }[]
}

export function youtubeIdOf(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : ''
  if (YOUTUBE_ID.test(text)) return text
  const match = text.match(/(?:v=|youtu\.be\/|embed\/|\/vi\/)([A-Za-z0-9_-]{11})/)
  return match?.[1] && YOUTUBE_ID.test(match[1]) ? match[1] : null
}

export function youtubeThumb(value: unknown): string | null {
  const id = youtubeIdOf(value)
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null
}

export function youtubeWatch(value: unknown): string | null {
  const id = youtubeIdOf(value)
  return id ? `https://www.youtube.com/watch?v=${id}` : null
}

function whole(value: number) {
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.floor(value)
}

/** The line at the top of the library. The words stay plural so the shape never changes. */
export function librarySummary(totals: LibraryTotals) {
  return `${whole(totals.courses)} courses · ${whole(totals.films)} films · ${whole(totals.playable)} playable · ${whole(totals.clips)} clips`
}

export function counted(value: number, singular: string, plural: string) {
  const n = whole(value)
  return `${n} ${n === 1 ? singular : plural}`
}

export function editorLink(path: string, options: { part?: number; films?: number } = {}) {
  const params = new URLSearchParams()
  if (options.part) params.set('part', String(options.part))
  if (options.films && options.films > 1) params.set('films', String(options.films))
  const text = params.toString()
  return text ? `${path}?${text}` : path
}

export function listLink(path: string, page: number) {
  return page > 1 ? `${path}?page=${page}` : path
}

export function relationshipsOf(fields: FieldLike[] | undefined): RelationField[] {
  const found: RelationField[] = []
  const walk = (list: FieldLike[] | undefined) => {
    for (const field of list || []) {
      if (field.type === 'relationship' && field.name && field.relationTo) {
        const collections = (Array.isArray(field.relationTo) ? field.relationTo : [field.relationTo]).filter((item): item is string => Boolean(item))
        found.push({ name: field.name, collections, hasMany: Boolean(field.hasMany) })
      }
      walk(field.fields)
      for (const tab of field.tabs || []) walk(tab.fields)
    }
  }
  walk(fields)
  return found
}

function asId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value && !Number.isNaN(Number(value))) return Number(value)
  if (value && typeof value === 'object' && 'id' in value) return asId((value as { id?: unknown }).id)
  return null
}

function idList(value: unknown): number[] {
  if (value == null || value === '') return []
  const list = Array.isArray(value) ? value : [value]
  return list.map((item) => asId(item)).filter((id): id is number => Boolean(id))
}

export function joinCodeName(doc: { id?: number; label?: unknown; code?: unknown }) {
  const label = typeof doc.label === 'string' ? doc.label.trim() : ''
  const code = typeof doc.code === 'string' ? doc.code.trim() : ''
  if (label && code && label !== code) return `${label} (${code})`
  return label || code || (doc.id ? `Code ${doc.id}` : '')
}

export function linksFromDoc(doc: Record<string, unknown> & { id: number }, rels: RelationField[], label: string): LinkedDoc {
  const courseIds: number[] = []
  const packIds: number[] = []
  let portalId: number | null = null
  for (const rel of rels) {
    const ids = idList(doc[rel.name])
    if (rel.collections.includes('courses')) courseIds.push(...ids)
    if (rel.collections.includes('packs')) packIds.push(...ids)
    if (rel.collections.includes('portals') && portalId == null) portalId = ids[0] ?? null
  }
  if (portalId == null) portalId = asId(doc.portal)
  return { id: doc.id, label, portalId, courseIds, packIds }
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en'))
}

/** Names the join codes, packs and portals that open this course. Packs may be an empty list. */
export function assembleUse(courseId: number, packs: LinkedDoc[], codes: LinkedDoc[], adoptions: LinkedDoc[], portals: { id: number; name: string }[]): CourseUse {
  const openPacks = packs.filter((pack) => pack.courseIds.includes(courseId))
  const packIds = new Set(openPacks.map((pack) => pack.id))
  const opens = (doc: LinkedDoc) => doc.courseIds.includes(courseId) || doc.packIds.some((id) => packIds.has(id))
  const portalIds = new Set<number>()
  for (const pack of openPacks) if (pack.portalId) portalIds.add(pack.portalId)
  for (const code of codes) if (opens(code) && code.portalId) portalIds.add(code.portalId)
  for (const adoption of adoptions) if (opens(adoption) && adoption.portalId) portalIds.add(adoption.portalId)
  const names = new Map(portals.map((portal) => [portal.id, portal.name]))
  return {
    codes: uniqueSorted(codes.filter(opens).map((code) => code.label)),
    packs: uniqueSorted(openPacks.map((pack) => pack.label)),
    portals: uniqueSorted([...portalIds].map((id) => names.get(id) || '')),
  }
}
