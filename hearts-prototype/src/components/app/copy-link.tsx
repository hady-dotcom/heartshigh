'use client'

import { useState } from 'react'

export function CopyLink({ value, testId = 'copy-link', label: idle = 'Copy link' }: { value: string; testId?: string; label?: string }) {
  const [label, setLabel] = useState(idle)
  return (
    <button
      type="button"
      className="pill outline small"
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
