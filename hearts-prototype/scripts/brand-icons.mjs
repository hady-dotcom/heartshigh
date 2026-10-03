// Builds the brand images from Leon's hoopoe sheet (public/brand/hoopoe-sheet.png, or hoopoe.png).
// The sheet holds several finished pieces of art, so this script only crops them out: nothing is redrawn.
//   hoopoe-mark.png     the head and crest (logo mark, app icons)
//   hoopoe-hero.png     the bird in flight against the dusk sky (splash, opener)
//   hoopoe-perched.png  the bird resting (empty states)
// Without the sheet, a plain gold monogram stands in for the icons.
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const brand = path.join(root, 'public', 'brand')
const out = path.join(root, 'public', 'icons')
mkdirSync(out, { recursive: true })
const sheet = [path.join(brand, 'hoopoe-sheet.png'), path.join(brand, 'hoopoe.png')].find((file) => existsSync(file))

// Regions on the 1536 x 1024 sheet.
const CROPS = {
  'hoopoe-mark.png': { left: 150, top: 160, width: 170, height: 170 },
  'hoopoe-hero.png': { left: 25, top: 158, width: 300, height: 185 },
  'hoopoe-perched.png': { left: 1030, top: 140, width: 180, height: 136 },
}

const monogram = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#f6f0e4"/>
  <circle cx="512" cy="512" r="360" fill="#dca643"/>
  <text x="512" y="640" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="400" fill="#1f1d36">H</text>
</svg>`)

if (sheet) {
  const meta = await sharp(sheet).metadata()
  const sx = (meta.width || 1536) / 1536
  const sy = (meta.height || 1024) / 1024
  for (const [name, box] of Object.entries(CROPS)) {
    const region = { left: Math.round(box.left * sx), top: Math.round(box.top * sy), width: Math.round(box.width * sx), height: Math.round(box.height * sy) }
    await sharp(sheet).extract(region).png({ compressionLevel: 9, palette: true, quality: 92 }).toFile(path.join(brand, name))
  }
}

async function icon(size, padding) {
  if (sheet) {
    const inner = Math.round(size * (1 - padding * 2))
    const layer = await sharp(path.join(brand, 'hoopoe-mark.png')).resize(inner, inner, { fit: 'cover' }).png().toBuffer()
    // The mark's own dusk sky fills the padding, so the icon reads as one piece of art.
    return sharp({ create: { width: size, height: size, channels: 4, background: '#2a2850' } }).composite([{ input: layer, gravity: "center" }]).png({ compressionLevel: 9, palette: true, quality: 92 })
  }
  const inner = Math.round(size * (1 - padding * 2))
  const layer = await sharp(monogram).resize(inner, inner).png().toBuffer()
  return sharp({ create: { width: size, height: size, channels: 4, background: '#f6f0e4' } }).composite([{ input: layer, gravity: "center" }]).png({ compressionLevel: 9, palette: true, quality: 92 })
}

await (await icon(192, 0)).toFile(path.join(out, 'icon-192.png'))
await (await icon(512, 0)).toFile(path.join(out, 'icon-512.png'))
await (await icon(512, 0.1)).toFile(path.join(out, 'maskable-512.png'))
await (await icon(180, 0)).toFile(path.join(out, 'apple-touch-icon.png'))
console.log(sheet ? `Brand crops and icons built from ${path.relative(root, sheet)}` : 'Icons built from the stand-in monogram. Add public/brand/hoopoe-sheet.png and run again.')
