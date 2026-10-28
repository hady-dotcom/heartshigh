import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { CoverKind } from '@/lib/cover-art'

const EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.avif']

export type CoverIndex = {
  courses?: Record<string, string>
  films?: Record<string, string>
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

/**
 * A photograph supplied for this course or film.
 * An uploaded cover is checked before this. A missing file means the drawn cover.
 * Names: supplied-covers/course/welcome.jpg, supplied-covers/course/33.jpg,
 * or an entry in supplied-covers/index.json.
 */
export function resolveSuppliedCover(input: {
  root: string
  kind: CoverKind
  id: number
  title: string
  index?: CoverIndex
  exists?: (file: string) => boolean
}) {
  const exists = input.exists ?? existsSync
  const slug = coverSlug(input.title)
  const bag = (input.kind === 'course' ? input.index?.courses : input.index?.films) || {}
  const named = [bag[String(input.id)], slug ? bag[slug] : '', bag[input.title]].filter((name): name is string => Boolean(name))
  const candidates = [
    ...named,
    ...EXTS.flatMap((ext) => [
      path.join(input.kind, `${input.id}${ext}`),
      ...(slug ? [path.join(input.kind, `${slug}${ext}`)] : []),
      `${input.kind}-${input.id}${ext}`,
      ...(slug ? [`${input.kind}-${slug}${ext}`] : []),
    ]),
  ]
  for (const candidate of candidates) {
    const file = insideRoot(input.root, candidate)
    if (file && coverContentType(file) && exists(file)) return file
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
