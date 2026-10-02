import { existsSync } from 'node:fs'
import path from 'node:path'

/** Leon's hoopoe artwork lives in public/brand. Until those files are added, a plain gold monogram stands in. */
export function hoopoeAsset(name: 'hoopoe.png' | 'hoopoe-sheet.png' = 'hoopoe.png') {
  return existsSync(path.join(process.cwd(), 'public', 'brand', name)) ? `/brand/${name}` : null
}

export function BrandMark({ size = 40 }: { size?: number }) {
  const src = hoopoeAsset()
  if (src) {
    return (
      <span className="brand-mark" style={{ width: size, height: size }}>
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

export function Mascot({ width = 120, alt = '' }: { width?: number; alt?: string }) {
  const src = hoopoeAsset()
  if (!src) return <BrandMark size={width * 0.7} />
  return <img src={src} alt={alt} style={{ width, height: 'auto' }} />
}
