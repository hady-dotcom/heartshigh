'use client'

import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { helpFor, learnerHelp } from '@/lib/page-help'

function HelpSheet({ title, body, titleId, onClose }: { title: string; body: string[]; titleId: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="page-help-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} data-testid="page-help-sheet" onClick={onClose}>
      <div className="page-help-card" onClick={(event) => event.stopPropagation()}>
        <h2 id={titleId}>{title}</h2>
        {body.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <button type="button" className="pill gold block" data-testid="page-help-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}

export function PageHelp({ page }: { page?: string }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const titleId = useId()
  const copy = helpFor(page)
  useEffect(() => setMounted(true), [])
  return (
    <div className={`page-help${open ? ' is-open' : ''}`} data-testid="page-help" data-page={page || ''}>
      <button type="button" className="page-help-btn" aria-label="How to use this page" data-testid="page-help-open" onClick={() => setOpen(true)}>
        ?
      </button>
      {open && mounted
        ? createPortal(<HelpSheet title={copy.title} body={copy.body} titleId={titleId} onClose={() => setOpen(false)} />, document.body)
        : null}
    </div>
  )
}

/** Small '?' on report, announce, and the player. Uses the same sheet as the page ?. */
export function TopicHelp({ topic, label = 'What is this?' }: { topic: string; label?: string }) {
  const text = learnerHelp(topic)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const titleId = useId()
  useEffect(() => setMounted(true), [])
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
        onClick={() => setOpen(true)}
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
      {open && mounted
        ? createPortal(
            <HelpSheet title={label} body={[text]} titleId={titleId} onClose={() => setOpen(false)} />,
            document.body,
          )
        : null}
    </span>
  )
}
