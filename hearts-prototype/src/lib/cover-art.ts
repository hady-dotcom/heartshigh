/** Deterministic editorial covers. No network, no model, the same item always draws the same picture. */

export type CoverKind = 'course' | 'film'

const HUES = [210, 198, 164, 22, 348, 262, 146, 92]

export function coverHash(seed: string) {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619)
  return hash >>> 0
}

function unit(hash: number, salt: number) {
  return ((Math.imul(hash ^ salt, 2246822519) >>> 0) % 10000) / 10000
}

/** A saturated hue shared by a course. Films sit beside it, far enough apart to tell them apart. */
export function coverHue(courseId: number, filmId?: number) {
  const base = HUES[Math.abs(courseId * 3) % HUES.length]
  if (!filmId) return base
  const step = Math.abs(filmId * 5) % 7
  return (base + (step - 3) * 16 + 360) % 360
}

export function coverColor(courseId: number, filmId?: number) {
  const hue = coverHue(courseId, filmId)
  const hash = coverHash(filmId ? `film:${filmId}` : `course:${courseId}`)
  const light = 30 + Math.round(unit(hash, 3) * 8)
  return `hsl(${hue} 68% ${light}%)`
}

export function coverPath(kind: CoverKind, id: number) {
  return `/cover/${kind}/${id}`
}

type IconName =
  | 'house'
  | 'book'
  | 'people'
  | 'heart'
  | 'sun'
  | 'target'
  | 'chat'
  | 'path'
  | 'layers'
  | 'leaf'
  | 'compass'
  | 'bolt'

const ICONS: Record<IconName, string[]> = {
  house: ['M4 11.2 12 4.5l8 6.7', 'M7.2 10.4V19.5h9.6V10.4'],
  book: ['M4.5 6.2c2.6-.8 5-.4 7.5.8 2.5-1.2 4.9-1.6 7.5-.8', 'M12 7v12', 'M4.5 6.2V17c2.6-.6 5-.2 7.5 1', 'M19.5 6.2V17c-2.6-.6-5-.2-7.5 1'],
  people: ['M12 8.4a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z', 'M5.4 19.4c.9-3.2 3.3-4.8 6.6-4.8s5.7 1.6 6.6 4.8'],
  heart: ['M12 18.4 5.6 12.2a3.6 3.6 0 0 1 5.1-5.1L12 8.4l1.3-1.3a3.6 3.6 0 0 1 5.1 5.1L12 18.4z'],
  sun: ['M12 15.6a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2z', 'M12 4.2v1.6', 'M12 18.2v1.6', 'M5.2 5.2l1.1 1.1', 'M17.7 17.7l1.1 1.1', 'M4.2 12h1.6', 'M18.2 12h1.6', 'M5.2 18.8l1.1-1.1', 'M17.7 6.3l1.1-1.1'],
  target: ['M12 18.6a6.6 6.6 0 1 0 0-13.2 6.6 6.6 0 0 0 0 13.2z', 'M12 14.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8z'],
  chat: ['M5 6h14v8.6H9.4L5 17.6V6z'],
  path: ['M5 16.8c2.8-5.2 4.6-6.6 7.4-6.6 2.4 0 3.4 1.6 6.2 1.6', 'M6.4 7.2a.8.8 0 1 0 0-1.6.8.8 0 0 0 0 1.6z', 'M16.8 17.4a.8.8 0 1 0 0-1.6.8.8 0 0 0 0 1.6z'],
  layers: ['M4.2 9 12 5.2 19.8 9 12 12.8 4.2 9z', 'M4.2 13.2 12 17l7.8-3.8', 'M4.2 16.6 12 20.4l7.8-3.8'],
  leaf: ['M5.4 18.2C6.2 10.4 11.4 5.4 19 4.8 18.2 12.6 13 17.6 5.4 18.2z', 'M8.4 14.8c1.4-2 3.4-3.6 6.4-4.6'],
  compass: ['M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M14.4 9.6 13 13.2 9.4 14.6 10.8 11 14.4 9.6z'],
  bolt: ['M13 4 6.4 12.6h4.8L10.2 20 17.2 11H12.2L13 4z'],
}

const TOPICS: { name: IconName; test: RegExp }[] = [
  { name: 'book', test: /book|read|summar|librar|page/i },
  { name: 'house', test: /home|house|welcome|guid|family/i },
  { name: 'people', test: /child|children|parent|people|social|student/i },
  { name: 'heart', test: /emotion|feeling|care|heart|kind/i },
  { name: 'target', test: /focus|attention|concentrat|work/i },
  { name: 'chat', test: /verbal|talk|speak|voice|question|word/i },
  { name: 'sun', test: /theor|learn|mind|idea|think|introduc/i },
  { name: 'path', test: /problem|solv|path|journey|step/i },
  { name: 'leaf', test: /grow|nature|ready|prepar/i },
  { name: 'layers', test: /resource|tool|module|plan/i },
  { name: 'compass', test: /direct|way|choos|decid/i },
  { name: 'bolt', test: /physical|body|move|energy|play/i },
]

export function coverIcon(title: string, seed: string): IconName {
  const hit = TOPICS.find((topic) => topic.test.test(title))
  if (hit) return hit.name
  const names = Object.keys(ICONS) as IconName[]
  return names[coverHash(seed) % names.length]
}

export function iconPaths(name: IconName) {
  return ICONS[name]
}

/** Line icon as a data URI. Stroke is white. Safe to drop into a CSS variable. */
export function iconDataUri(name: IconName) {
  const body = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'>${ICONS[name].map((d) => `<path d='${d}'/>`).join('')}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(body)}")`
}

function hsl(hue: number, sat: number, light: number, alpha = 1) {
  const a = alpha < 1 ? ` / ${alpha}` : ''
  return `hsl(${hue} ${sat}% ${light}%${a})`
}

/** Artwork only. The page sets the title over it, in the system face. */
export function coverSvg(input: { seed: string; title: string; hue: number; wide?: boolean; kicker?: string }) {
  const hash = coverHash(input.seed + input.title)
  const w = input.wide ? 1200 : 800
  const h = input.wide ? 900 : 1100
  const icon = coverIcon(input.title, input.seed)
  const lightX = Math.round(w * (0.62 + unit(hash, 11) * 0.28))
  const lightY = Math.round(h * (0.02 + unit(hash, 12) * 0.22))
  const bloomX = Math.round(w * (0.08 + unit(hash, 21) * 0.3))
  const bloomY = Math.round(h * (0.55 + unit(hash, 22) * 0.3))
  const accent = (input.hue + 18 + Math.round(unit(hash, 31) * 16)) % 360
  const deep = (input.hue + 360 - 12) % 360
  const iconSize = input.wide ? 96 : 108
  const iconX = 64
  const iconY = input.wide ? 64 : 76
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <radialGradient id="bloom" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${hsl(accent, 62, 52)}"/>
      <stop offset="48%" stop-color="${hsl(accent, 54, 38)}"/>
      <stop offset="100%" stop-color="${hsl(accent, 72, 44)}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="depth" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${hsl(deep, 55, 16)}"/>
      <stop offset="100%" stop-color="${hsl(deep, 55, 16)}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="light" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="white" stop-opacity="0.9"/>
      <stop offset="28%" stop-color="white" stop-opacity="0.28"/>
      <stop offset="70%" stop-color="white" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="white" stop-opacity="0.2"/>
      <stop offset="42%" stop-color="white" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="48%" stop-color="black" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.78"/>
    </linearGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${hash % 80}"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.14"/></feComponentTransfer>
    </filter>
  </defs>
  <rect width="${w}" height="${h}" fill="${hsl(input.hue, 58, 24)}"/>
  <ellipse cx="${bloomX}" cy="${bloomY}" rx="${Math.round(w * 0.72)}" ry="${Math.round(h * 0.42)}" fill="url(#bloom)"/>
  <ellipse cx="${lightX}" cy="${lightY}" rx="${Math.round(w * 0.55)}" ry="${Math.round(h * 0.32)}" fill="url(#light)"/>
  <ellipse cx="${Math.round(w * 0.2)}" cy="${Math.round(h * 0.85)}" rx="${Math.round(w * 0.6)}" ry="${Math.round(h * 0.28)}" fill="url(#depth)"/>
  <rect width="${w}" height="${h}" fill="url(#sheen)"/>
  <rect width="${w}" height="${h}" filter="url(#grain)"/>
  <rect width="${w}" height="${h}" fill="url(#scrim)"/>
  <g transform="translate(${iconX} ${iconY}) scale(${iconSize / 24})" fill="none" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    ${ICONS[icon].map((d) => `<path d="${d}"/>`).join('')}
  </g>
</svg>`
}
