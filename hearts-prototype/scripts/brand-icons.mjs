// Builds the home-screen icons. Uses public/brand/hoopoe.png when it exists, otherwise a plain gold monogram.
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const out = path.join(root, 'public', 'icons')
mkdirSync(out, { recursive: true })
const hoopoe = path.join(root, 'public', 'brand', 'hoopoe.png')

const monogram = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#f6f0e4"/>
  <circle cx="512" cy="512" r="360" fill="#dca643"/>
  <text x="512" y="640" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="400" fill="#1f1d36">H</text>
</svg>`)

async function art(size, padding) {
  const inner = Math.round(size * (1 - padding * 2))
  const source = existsSync(hoopoe) ? sharp(hoopoe).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }) : sharp(monogram).resize(inner, inner)
  const layer = await source.png().toBuffer()
  return sharp({ create: { width: size, height: size, channels: 4, background: '#f6f0e4' } })
    .composite([{ input: layer, gravity: 'center' }])
    .png()
}

await (await art(192, 0.04)).toFile(path.join(out, 'icon-192.png'))
await (await art(512, 0.04)).toFile(path.join(out, 'icon-512.png'))
await (await art(512, 0.16)).toFile(path.join(out, 'maskable-512.png'))
await (await art(180, 0.06)).toFile(path.join(out, 'apple-touch-icon.png'))
console.log(existsSync(hoopoe) ? 'Icons built from public/brand/hoopoe.png' : 'Icons built from the stand-in monogram. Add public/brand/hoopoe.png and run again.')
