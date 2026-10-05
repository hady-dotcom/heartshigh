'use client'

import { useState } from 'react'
import { learnerHelp } from '@/lib/page-help'

export function PageHelp({ topic, label = 'What is this?' }: { topic: string; label?: string }) {
  const text = learnerHelp(topic)
  const [open, setOpen] = useState(false)
  if (!text) return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
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
          color: '#F6EEDC',
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
            background: '#F6EEDC',
            color: '#1A1408',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(14,42,43,0.28)',
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
