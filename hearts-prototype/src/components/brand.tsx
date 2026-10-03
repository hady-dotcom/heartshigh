import { Arch } from '@/components/arch'

/** The desk and door mark: a fine-line arch in gold, in place of the hoopoe from the parked games. */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <span className="brand-mark arch" style={{ width: size, height: size }} aria-hidden>
      <Arch size={Math.round(size * 0.72)} />
    </span>
  )
}
