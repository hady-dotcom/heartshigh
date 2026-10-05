import { Arch } from '@/components/arch'

/** The desk and door mark: a fine-line arch in gold. */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <span className="brand-mark arch" style={{ width: size, height: size }} aria-hidden>
      <Arch size={Math.round(size * 0.72)} />
    </span>
  )
}

/** Hady Core with the gold arch. Join, sign-in and the door use this. */
export function BrandLockup({ size = 72 }: { size?: number }) {
  return (
    <div className="brand-lockup">
      <BrandMark size={size} />
      <p className="brand-word">Hady Core</p>
    </div>
  )
}
