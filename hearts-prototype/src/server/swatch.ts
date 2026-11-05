import { readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import type { CSSProperties } from 'react'
import { headers } from 'next/headers'

const ALLOWED = new Set(['i.vimeocdn.com', 'i.ytimg.com', 'img.youtube.com'])
const cache = new Map<string, string>()

export function swatchHostAllowed(src: string) {
  if (src.startsWith('/') && !src.startsWith('//')) return !src.includes('..')
  try {
    const url = new URL(src)
    return url.protocol === 'https:' && ALLOWED.has(url.hostname)
  } catch {
    return false
  }
}

async function loadBytes(src: string) {
  if (src.startsWith('/') && !src.startsWith('//')) {
    const root = path.join(process.cwd(), 'public')
    const full = path.resolve(root, src.split('?')[0].replace(/^\/+/, ''))
    if (full !== root && !full.startsWith(root + path.sep)) return null
    return readFile(full)
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 2500)
  try {
    const res = await fetch(src, { signal: ctrl.signal, redirect: 'manual' })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } finally {
    clearTimeout(timer)
  }
}

function average(data: Buffer) {
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  let ar = 0
  let ag = 0
  let ab = 0
  let an = 0
  for (let i = 0; i < data.length; i += 3) {
    const R = data[i]
    const G = data[i + 1]
    const B = data[i + 2]
    ar += R
    ag += G
    ab += B
    an += 1
    const max = Math.max(R, G, B)
    const min = Math.min(R, G, B)
    if (max - min < 18 || max < 24) continue
    r += R
    g += G
    b += B
    n += 1
  }
  const count = n || an
  if (!count) return ''
  const rr = Math.round((n ? r : ar) / count)
  const gg = Math.round((n ? g : ag) / count)
  const bb = Math.round((n ? b : ab) / count)
  return `rgb(${rr} ${gg} ${bb})`
}

/** Dominant colour of a film still. Empty when the file cannot be read. */
export async function swatchFor(src: string | null | undefined) {
  if (!src || !swatchHostAllowed(src)) return ''
  const cached = cache.get(src)
  if (cached) return cached
  try {
    const bytes = await loadBytes(src)
    if (!bytes) return ''
    const { data } = await sharp(bytes).resize(12, 12, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const color = average(data)
    if (color) cache.set(src, color)
    return color
  } catch {
    return ''
  }
}

export async function swatchMap(srcs: readonly (string | null | undefined)[]) {
  const unique = [...new Set(srcs.filter((src): src is string => Boolean(src)))]
  const out = new Map<string, string>()
  await Promise.all(unique.map(async (src) => {
    const color = await swatchFor(src)
    if (color) out.set(src, color)
  }))
  return out
}

export async function appleLookOnServer() {
  return (await headers()).get('x-hh-look') === 'apple'
}

export function artStyle(color: string | undefined | null): CSSProperties | undefined {
  if (!color) return undefined
  return { ['--art' as string]: color }
}
