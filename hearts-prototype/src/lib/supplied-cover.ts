import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { CoverKind } from '@/lib/cover-art'

const EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.avif']

export type CoverFrame = 'wide' | 'tall'

/** One file for every frame, or a wide 16:9 and a tall 4:5. */
export type CoverSlot = string | { wide?: string; tall?: string }

export type CoverIndex = {
  courses?: Record<string, CoverSlot>
  films?: Record<string, CoverSlot>
}

/** "Working with your Child" becomes "working-with-your-child". */
export function coverSlug(title: string) {
  return title
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function coverContentType(file: string) {
  const ext = path.extname(file).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.avif') return 'image/avif'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  return null
}

function insideRoot(root: string, file: string) {
  const base = path.resolve(root)
  const resolved = path.resolve(base, file)
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null
  return resolved
}

function slotFile(slot: CoverSlot | undefined, frame: CoverFrame) {
  if (!slot) return ''
  if (typeof slot === 'string') return slot
  return slot[frame] || ''
}

function candidatesFor(input: {
  kind: CoverKind
  id: number
  title: string
  frame: CoverFrame
  bag: Record<string, CoverSlot>
}) {
  const slug = coverSlug(input.title)
  const suffix = input.frame === 'tall' ? '4x5' : '16x9'
  const named = [slotFile(input.bag[String(input.id)], input.frame), slug ? slotFile(input.bag[slug], input.frame) : '', slotFile(input.bag[input.title], input.frame)].filter(Boolean)
  return [
    ...named,
    ...EXTS.flatMap((ext) => [
      path.join(input.kind, `${input.id}-${suffix}${ext}`),
      ...(slug ? [path.join(input.kind, `${slug}-${suffix}${ext}`)] : []),
      `${input.kind}-${input.id}-${suffix}${ext}`,
      ...(slug ? [`${slug}-${suffix}${ext}`] : []),
      path.join(input.kind, `${input.id}${ext}`),
      ...(slug ? [path.join(input.kind, `${slug}${ext}`)] : []),
    ]),
  ]
}

/**
 * A photograph supplied for this course or film.
 * Wide is 16:9. Tall is 4:5. A film with no picture of its own uses its course.
 * An uploaded cover is checked before this. A missing file means the drawn cover.
 */
export function resolveSuppliedCover(input: {
  root: string
  kind: CoverKind
  id: number
  title: string
  frame?: CoverFrame
  courseId?: number
  courseTitle?: string
  index?: CoverIndex
  exists?: (file: string) => boolean
}) {
  const exists = input.exists ?? existsSync
  const frame = input.frame === 'tall' ? 'tall' : 'wide'
  const index = input.index || {}
  const ownBag = (input.kind === 'course' ? index.courses : index.films) || {}
  const lists = [candidatesFor({ kind: input.kind, id: input.id, title: input.title, frame, bag: ownBag })]
  if (input.kind === 'film' && input.courseId) {
    lists.push(candidatesFor({ kind: 'course', id: input.courseId, title: input.courseTitle || '', frame, bag: index.courses || {} }))
  }
  for (const candidates of lists) {
    for (const candidate of candidates) {
      const file = insideRoot(input.root, candidate)
      if (file && coverContentType(file) && exists(file)) return file
    }
  }
  return null
}

export function suppliedCoverRoot() {
  return path.join(process.cwd(), 'supplied-covers')
}

export function readCoverIndex(root: string): CoverIndex {
  try {
    const parsed = JSON.parse(readFileSync(path.join(root, 'index.json'), 'utf8')) as CoverIndex
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * True when learners would see the drawn cover.
 * An upload or a file in supplied-covers/ counts. A film may use its course photograph.
 */
export function needsCover(input: {
  kind: CoverKind
  id: number
  title: string
  uploaded?: boolean
  courseId?: number
  courseTitle?: string
}) {
  if (input.uploaded) return false
  const root = suppliedCoverRoot()
  const index = readCoverIndex(root)
  const found = resolveSuppliedCover({
    root,
    kind: input.kind,
    id: input.id,
    title: input.title,
    courseId: input.kind === 'film' ? input.courseId : undefined,
    courseTitle: input.courseTitle,
    index,
  })
  return !found
}
