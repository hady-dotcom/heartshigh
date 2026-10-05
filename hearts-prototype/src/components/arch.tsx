/** A fine-line arch: the Hady Core mark. */
export function Arch({ size = 48, title }: { size?: number; title?: string }) {
  return (
    <svg className="arch" width={size} height={size} viewBox="0 0 64 64" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} aria-label={title}>
      <path d="M8 56 V30 C8 12 56 12 56 30 V56" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M20 56 V34 C20 24 44 24 44 34 V56" fill="none" stroke="currentColor" strokeWidth="1.15" />
      <path d="M32 18.5 v-6" fill="none" stroke="currentColor" strokeWidth="1.15" />
      <circle cx="32" cy="10" r="1.3" fill="currentColor" />
    </svg>
  )
}
