'use client'

import { useEffect, useId, useState } from 'react'
import { helpFor } from '@/lib/page-help'

export function PageHelp({ page }: { page?: string }) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const copy = helpFor(page)
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <div className="page-help" data-testid="page-help">
      <button type="button" className="page-help-btn" aria-label="How to use this page" data-testid="page-help-open" onClick={() => setOpen(true)}>
        ?
      </button>
      {open ? (
        <div className="page-help-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} data-testid="page-help-sheet">
          <div className="page-help-card">
            <h2 id={titleId}>{copy.title}</h2>
            {copy.body.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <button type="button" className="pill gold block" data-testid="page-help-close" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
