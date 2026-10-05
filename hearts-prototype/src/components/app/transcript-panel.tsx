'use client'

import { useState } from 'react'
import { PageHelp } from '@/components/app/page-help'
import type { CaptionCue } from '@/lib/spoken-caption'

type Paragraph = { start: number; timestamp: string; text: string }

export function TranscriptPanel({
  paragraphs,
  seconds,
  title,
  onJump,
}: {
  paragraphs: Paragraph[]
  seconds: number
  title: string
  cues?: CaptionCue[]
  onJump?: (start: number) => void
}) {
  const [open, setOpen] = useState(false)
  const current = paragraphs.reduce((best, row, index) => (row.start <= seconds ? index : best), -1)
  const download = () => {
    const body = `${title}\n\n${paragraphs.map((row) => `${row.timestamp}  ${row.text}`).join('\n\n')}`
    const blob = new Blob([body], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${title.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'transcript'}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <section className="transcript-panel" data-testid="transcript-panel">
      <div className="transcript-head">
        <button type="button" className="pill outline small" onClick={() => setOpen((value) => !value)} data-testid="transcript-toggle" aria-expanded={open}>
          {open ? 'Hide transcript' : 'Transcript'}
        </button>
        <PageHelp topic="course">The transcript is the whole talk as tidy paragraphs. It never sits over the film. Tap a line to jump there.</PageHelp>
        {open && paragraphs.length ? (
          <button type="button" className="link-btn" onClick={download} data-testid="transcript-download">
            Download as text
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="transcript-body" data-testid="transcript-body">
          {paragraphs.length ? (
            paragraphs.map((row, index) => (
              <button
                key={`${row.start}-${index}`}
                type="button"
                className={`transcript-line${index === current ? ' on' : ''}`}
                data-testid="transcript-line"
                data-current={index === current ? 'yes' : 'no'}
                onClick={() => onJump?.(row.start)}
              >
                <small>{row.timestamp}</small>
                <span>{row.text}</span>
              </button>
            ))
          ) : (
            <p className="muted" data-testid="transcript-empty">This talk has no transcript yet.</p>
          )}
        </div>
      ) : null}
    </section>
  )
}
