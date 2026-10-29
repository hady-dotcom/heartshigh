import { Arch } from '@/components/arch'

/** The desk and door mark: a fine-line arch in gold. */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <span className="brand-mark arch" style={{ width: size, height: size }} aria-hidden>
      <Arch size={Math.round(size * 0.72)} />
    </span>
  )
}

/** The door wordmark. The site itself is Hady. A HEARTS portal passes its own name. */
export function BrandLockup({ size = 72, name = 'Hady' }: { size?: number; name?: string }) {
  return (
    <div className="brand-lockup">
      <BrandMark size={size} />
      <p className="brand-word">{name}</p>
    </div>
  )
}
