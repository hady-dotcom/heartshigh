import sharp from 'sharp'
import { readCoverIndex, resolveSuppliedCover, suppliedCoverRoot } from '@/lib/supplied-cover'

/** A soft page tint and a deep button colour taken from a photograph. */
export function toneFromRgb(r: number, g: number, b: number) {
  const [hue, sat] = rgbToHsl(r, g, b)
  const rich = Math.min(42, Math.max(26, sat))
  const wash = `hsl(${Math.round(hue)} ${Math.round(Math.min(32, rich))}% 86%)`
  let light = 28
  for (let step = 38; step >= 22; step -= 1) {
    const [red, green, blue] = hslToRgb(hue, rich, step)
    if (contrastOnWhite(red, green, blue) >= 4.5) {
      light = step
      break
    }
  }
  return { wash, tone: `hsl(${Math.round(hue)} ${Math.round(rich)}% ${light}%)` }
}

const cache = new Map<string, { wash: string; tone: string }>()

/** The cover's own colour when a photograph is supplied. Otherwise the portal accent on white. */
export async function coverPaint(courseId: number, title = '') {
  const key = `${courseId}:${title}`
  const cached = cache.get(key)
  if (cached) return cached
  const root = suppliedCoverRoot()
  const file = resolveSuppliedCover({
    root,
    kind: 'course',
    id: courseId,
    title,
    index: readCoverIndex(root),
  })
  const paint = { wash: 'var(--hh-paper)', tone: 'var(--hh-accent)' }
  if (file) {
    const rgb = await saturatedAverage(file).catch(() => null)
    if (rgb) {
      const tone = toneFromRgb(rgb[0], rgb[1], rgb[2])
      paint.wash = tone.wash
      paint.tone = tone.tone
    }
  }
  cache.set(key, paint)
  return paint
}

async function saturatedAverage(file: string) {
  const { data } = await sharp(file).resize(48, 27, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  let red = 0
  let green = 0
  let blue = 0
  let weight = 0
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const light = (max + min) / 2
    if (light < 48 || light > 232) continue
    const sat = max === 0 ? 0 : (max - min) / max
    if (sat < 0.12) continue
    const w = sat * sat
    red += r * w
    green += g * w
    blue += b * w
    weight += w
  }
  if (!weight) return null
  return [Math.round(red / weight), Math.round(green / weight), Math.round(blue / weight)] as const
}

function rgbToHsl(r: number, g: number, b: number) {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const light = (max + min) / 2
  if (max === min) return [0, 0, light * 100] as const
  const delta = max - min
  const sat = light > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let hue = 0
  if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0)
  else if (max === green) hue = (blue - red) / delta + 2
  else hue = (red - green) / delta + 4
  return [hue * 60, sat * 100, light * 100] as const
}

function hslToRgb(h: number, s: number, l: number) {
  const sat = s / 100
  const light = l / 100
  const a = sat * Math.min(light, 1 - light)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return light - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
  }
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)] as const
}

function contrastOnWhite(r: number, g: number, b: number) {
  const f = (c: number) => {
    const x = c / 255
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  const lum = 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  return 1.05 / (lum + 0.05)
}
