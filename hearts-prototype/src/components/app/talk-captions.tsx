'use client'

import { useEffect, useState } from 'react'
import { HEARTS_CAPTION_KEY } from '@/lib/storage-keys'
import { cueAt, type CaptionCue } from '@/lib/spoken-caption'

/** The only text over a speaker: the timed spoken line, punctuated. */
export function TalkCaptions({ cues, seconds }: { cues: CaptionCue[]; seconds: number }) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    try {
      setOn(window.localStorage.getItem(HEARTS_CAPTION_KEY) === 'on')
    } catch {
      setOn(false)
    }
  }, [])
  const toggle = () => {
    const next = !on
    setOn(next)
    try {
      window.localStorage.setItem(HEARTS_CAPTION_KEY, next ? 'on' : 'off')
    } catch {
      // Private mode.
    }
  }
  const cue = on ? cueAt(cues, seconds) : null
  return (
    <div className="talk-captions" data-testid="talk-captions" data-on={on ? 'yes' : 'no'}>
      <button type="button" className={`cc-toggle${on ? ' on' : ''}`} onClick={toggle} aria-pressed={on} data-testid="cc-toggle">
        CC
      </button>
      {cue ? (
        <p className="spoken-line" data-testid="spoken-line">
          {cue.text}
        </p>
      ) : null}
    </div>
  )
}
