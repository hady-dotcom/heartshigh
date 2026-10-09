// Draws the HEARTS arch as /favicon.ico (16, 32 and 48 inside) and the small PNG icons beside the app icons.
// Strokes are heavier than the brand mark so the arch still reads at 16 pixels. Usage: node scripts/make-favicons.mjs
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TEAL = '#0f3b3a'
const GOLD = '#d4a84b'

function svg(size) {
  const small = size <= 32
  const outer = small ? 6.5 : 4.6
  const inner = small ? 5 : 3.6
  const radius = size >= 96 ? 14 : 12
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${radius}" fill="${TEAL}"/>
  <path d="M12 54 V31 C12 13 52 13 52 31 V54" fill="none" stroke="${GOLD}" stroke-width="${outer}" stroke-linecap="round"/>
  <path d="M${small ? 25 : 23} 54 V35 C${small ? 25 : 23} 26 ${small ? 39 : 41} 26 ${small ? 39 : 41} 35 V54" fill="none" stroke="${GOLD}" stroke-width="${inner}" stroke-linecap="round"/>
  ${small ? '' : `<path d="M32 17.5 v-5" stroke="${GOLD}" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="9.5" r="2.6" fill="${GOLD}"/>`}
</svg>`
}

const png = (size) => sharp(Buffer.from(svg(size))).png({ compressionLevel: 9 }).toBuffer()

function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach(({ size, data }, index) => {
    const at = 6 + index * 16
    header.writeUInt8(size >= 256 ? 0 : size, at)
    header.writeUInt8(size >= 256 ? 0 : size, at + 1)
    header.writeUInt16LE(1, at + 4)
    header.writeUInt16LE(32, at + 6)
    header.writeUInt32LE(data.length, at + 8)
    header.writeUInt32LE(offset, at + 12)
    offset += data.length
  })
  return Buffer.concat([header, ...images.map((image) => image.data)])
}

const sizes = [16, 32, 48]
const images = await Promise.all(sizes.map(async (size) => ({ size, data: await png(size) })))
writeFileSync(path.join(root, 'public', 'favicon.ico'), ico(images))
for (const { size, data } of images) writeFileSync(path.join(root, 'public', 'icons', `favicon-${size}.png`), data)
writeFileSync(path.join(root, 'public', 'icons', 'favicon-96.png'), await png(96))
console.log('Wrote public/favicon.ico and public/icons/favicon-16, 32, 48 and 96.png')
