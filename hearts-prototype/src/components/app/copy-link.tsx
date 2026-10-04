'use client'

import { useState } from 'react'

export function CopyLink({ value, testId = 'copy-link', label: idle = 'Copy link', className = 'btn ghost small' }: { value: string; testId?: string; label?: string; className?: string }) {
  const [label, setLabel] = useState(idle)
  return (
    <button
      type="button"
      className={className}
      data-testid={testId}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setLabel('Copied')
        } catch {
          setLabel('Try again')
        }
      }}
    >
      {label}
    </button>
  )
}
