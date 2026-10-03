import { Arch } from '@/components/arch'

/** The desk and door mark: a fine-line arch in gold, in place of the hoopoe. */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <span className="brand-mark arch" style={{ width: size, height: size }} aria-hidden>
      <Arch size={Math.round(size * 0.72)} />
    </span>
  )
}

/** HEARTS with the gold arch. Join, sign-in and the door use this. */
export function BrandLockup({ size = 72 }: { size?: number }) {
  return (
    <div className="brand-lockup">
      <BrandMark size={size} />
      <p className="brand-word">HEARTS</p>
    </div>
  )
}

/** Empty states and the welcome splash. The hoopoe art is parked; the arch stands in. */
export function Mascot({ width = 120 }: { width?: number; alt?: string; pose?: 'perched' | 'hero' }) {
  return <BrandMark size={Math.max(40, Math.round(width * 0.45))} />
}
