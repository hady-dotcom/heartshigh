import { existsSync } from 'node:fs'
import path from 'node:path'

type BrandFile = 'hoopoe-mark.png' | 'hoopoe-hero.png' | 'hoopoe-perched.png'

/** Crops of Leon's hoopoe sheet, made by scripts/brand-icons.mjs. A plain gold monogram stands in if they are missing. */
export function hoopoeAsset(name: BrandFile = 'hoopoe-mark.png') {
  return existsSync(path.join(process.cwd(), 'public', 'brand', name)) ? `/brand/${name}` : null
}

export function BrandMark({ size = 40 }: { size?: number }) {
  const src = hoopoeAsset('hoopoe-mark.png')
  if (src) {
    return (
      <span className="brand-mark art" style={{ width: size, height: size }}>
        <img src={src} alt="Hudhud" />
      </span>
    )
  }
  return (
    <span className="brand-mark mono" style={{ width: size, height: size, fontSize: size * 0.5 }} aria-label="Hudhud">
      H
    </span>
  )
}

export function Mascot({ width = 120, alt = '', pose = 'perched' }: { width?: number; alt?: string; pose?: 'perched' | 'hero' }) {
  const src = hoopoeAsset(pose === 'hero' ? 'hoopoe-hero.png' : 'hoopoe-perched.png')
  if (!src) return <BrandMark size={width * 0.7} />
  return <img className={`mascot ${pose}`} src={src} alt={alt} style={{ width, height: 'auto' }} />
}
