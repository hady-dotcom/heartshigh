'use client'

import { useState } from 'react'

export function CopyLink({ value, testId = 'copy-link' }: { value: string; testId?: string }) {
  const [label, setLabel] = useState('Copy link')
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
          setLabel('Select the link and copy it')
        }
      }}
    >
      {label}
    </button>
  )
}
