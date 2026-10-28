/** Deterministic editorial covers. No network, no model, the same item always draws the same picture. */

import type { CSSProperties } from 'react'

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

/** A near-white tint of the hue, for the page behind a photograph. */
export function coverPage(courseId: number, filmId?: number) {
  return `hsl(${coverHue(courseId, filmId)} 62% 96%)`
}

/** A bright form of the hue, for a button. Saturation stays high so it does not turn brown. */
export function coverVivid(courseId: number, filmId?: number) {
  return `hsl(${coverHue(courseId, filmId)} 88% 42%)`
}

/** Each film pans and tints the shared course photograph until it has its own picture. */
export function filmFrameStyle(courseId: number, filmId: number): CSSProperties {
  const hash = coverHash(`film-crop:${filmId}`)
  return {
    ['--art' as string]: coverColor(courseId, filmId),
    ['--film' as string]: coverVivid(courseId, filmId),
    ['--crop-x' as string]: `${8 + (hash % 78)}%`,
    ['--crop-y' as string]: `${4 + ((hash >>> 8) % 78)}%`,
  }
}

/** Wide cards and heroes ask for 16:9. Tall cards and shelves ask for 4:5. */
export function coverPath(kind: CoverKind, id: number, frame: 'wide' | 'tall' = 'wide') {
  return `/cover/${kind}/${id}?shape=${frame}`
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
  people: ['M12 4.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8z', 'M6.2 19.8c.3-3.8 2.7-5.6 5.8-5.6s5.5 1.8 5.8 5.6'],
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

const LINES: Record<IconName, string> = {
  house: 'Begin at home',
  book: 'A short reading',
  people: 'With your child',
  heart: 'Feelings, in order',
  sun: 'The idea, plainly',
  target: 'One thing at a time',
  chat: 'Words you can use',
  path: 'A way through',
  layers: 'What you need first',
  leaf: 'Ready when you are',
  compass: 'Choose the next step',
  bolt: 'Move, then talk',
}

export function coverLine(title: string) {
  return LINES[coverIcon(title, title)]
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

/** A clear colour field. Shapes stay sharp. Light is a corner wash, never a white oval. */
export function coverSvg(input: { seed: string; title: string; hue: number; wide?: boolean; kicker?: string }) {
  const hash = coverHash(input.seed + input.title)
  const w = input.wide ? 1200 : 800
  const h = input.wide ? 900 : 1100
  const icon = coverIcon(input.title, input.seed)
  const hue = input.hue
  const shape = hash % 3
  const lightFromLeft = unit(hash, 11) > 0.5
  const circleX = Math.round(w * (0.18 + unit(hash, 21) * 0.64))
  const circleY = Math.round(h * (0.22 + unit(hash, 22) * 0.36))
  const circleR = Math.round(Math.min(w, h) * (0.34 + unit(hash, 23) * 0.12))
  const iconSize = input.wide ? 210 : 188
  const iconX = Math.round(w * 0.1)
  const iconY = Math.round(h * 0.16)
  const plate = iconSize * 0.72
  const shapes = shape === 0
    ? `<circle cx="${circleX}" cy="${circleY}" r="${circleR}" fill="${hsl(hue, 78, 62)}"/>
       <circle cx="${circleX}" cy="${circleY}" r="${Math.round(circleR * 0.72)}" fill="none" stroke="${hsl(hue, 82, 76)}" stroke-width="${Math.round(circleR * 0.08)}"/>`
    : shape === 1
      ? `<path d="M0 0 H${w} L0 ${Math.round(h * 0.62)} Z" fill="${hsl(hue, 76, 58)}"/>
         <circle cx="${Math.round(w * 0.78)}" cy="${Math.round(h * 0.28)}" r="${Math.round(circleR * 0.55)}" fill="none" stroke="${hsl(hue, 80, 74)}" stroke-width="22"/>`
      : `<circle cx="${Math.round(w * 0.22)}" cy="${Math.round(h * 0.3)}" r="${Math.round(circleR * 0.7)}" fill="${hsl(hue, 80, 60)}"/>
         <circle cx="${Math.round(w * 0.72)}" cy="${Math.round(h * 0.48)}" r="${Math.round(circleR * 0.5)}" fill="${hsl((hue + 16) % 360, 70, 52)}"/>`
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="light" x1="${lightFromLeft ? 0 : 1}" y1="0" x2="${lightFromLeft ? 1 : 0}" y2="1">
      <stop offset="0%" stop-color="white" stop-opacity="0.28"/>
      <stop offset="42%" stop-color="white" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="62%" stop-color="${hsl(hue, 70, 18)}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${hsl(hue, 72, 14)}" stop-opacity="0.9"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="${hsl(hue, 74, 46)}"/>
  ${shapes}
  <rect width="${w}" height="${h}" fill="url(#light)"/>
  <rect width="${w}" height="${h}" fill="url(#scrim)"/>
  <circle cx="${iconX + iconSize / 2}" cy="${iconY + iconSize / 2}" r="${plate}" fill="white" fill-opacity="0.16"/>
  <g transform="translate(${iconX} ${iconY}) scale(${iconSize / 24})" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    ${ICONS[icon].map((d) => `<path d="${d}"/>`).join('')}
  </g>
</svg>`
}
