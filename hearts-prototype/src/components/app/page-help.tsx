'use client'

import { useEffect, useId, useState } from 'react'
import { helpFor, learnerHelp } from '@/lib/page-help'

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

/** Small '?' on report and announce. Evening garden colours — no cream. */
export function TopicHelp({ topic, label = 'What is this?' }: { topic: string; label?: string }) {
  const text = learnerHelp(topic)
  const [open, setOpen] = useState(false)
  if (!text) return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}>
      <button
        type="button"
        className="help-mark"
        data-help={topic}
        data-testid={`page-help-${topic}`}
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          border: '1px solid #D4A84B',
          background: '#0E2A2B',
          color: '#D4A84B',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        ?
      </button>
      {open ? (
        <span
          role="dialog"
          data-testid={`page-help-pop-${topic}`}
          style={{
            position: 'absolute',
            zIndex: 20,
            maxWidth: 280,
            marginTop: 28,
            padding: '12px 14px',
            background: '#0E2A2B',
            color: '#F4F0E6',
            border: '1px solid #D4A84B',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(14,42,43,0.45)',
            fontSize: 14,
            lineHeight: 1.45,
          }}
        >
          {text}
        </span>
      ) : null}
    </span>
  )
}
