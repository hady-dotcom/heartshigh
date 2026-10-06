'use client'

import { useEffect, useState } from 'react'
import { learnerEmbedSrc } from '@/lib/yt'

type Segment = { key: string; label: string; start: number; end: number }

/** Plays one segment of the talk at a time: from its in point to its out point, then stops. */
export function ReviewPlayer({ youtubeId, segments, autoplay }: { youtubeId: string | null; segments: Segment[]; autoplay?: string }) {
  const [playing, setPlaying] = useState<{ segment: Segment; nonce: number } | null>(() => {
    const first = segments.find((segment) => segment.key === autoplay)
    return first ? { segment: first, nonce: 0 } : null
  })
  const play = (segment: Segment) => setPlaying({ segment, nonce: Date.now() })
  return (
    <div data-testid="review-player">
      <div className="tier-player">
        {youtubeId && playing ? (
          <iframe
            key={playing.nonce}
            title={playing.segment.label}
            src={learnerEmbedSrc(youtubeId, { start: Math.floor(playing.segment.start), end: Math.ceil(playing.segment.end), autoplay: 1, playsinline: 1, rel: 0, cc_load_policy: 1, cc_lang_pref: 'en', controls: 1 })}
            allow="autoplay; encrypted-media"
            allowFullScreen
            data-testid="review-frame"
            data-segment={playing.segment.key}
            data-start={Math.floor(playing.segment.start)}
            data-end={Math.ceil(playing.segment.end)}
          />
        ) : (
          <p className="hint">{youtubeId ? 'Choose what to watch. Each plays from its in point and stops at its out point.' : 'This talk has no film link, so it cannot be watched here.'}</p>
        )}
      </div>
      <div className="actions">
        {segments.map((segment) => (
          <button key={segment.key} type="button" className="btn ghost small" onClick={() => play(segment)} disabled={!youtubeId} data-key={segment.key} data-testid={`review-play-${segment.key}`}>
            {segment.label} <kbd>{segment.key.toUpperCase()}</kbd>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Keyboard shortcuts for the review screens: each key clicks the element marked with data-key, arrows follow j and k. */
export function ReviewKeys() {
  useEffect(() => {
    document.documentElement.dataset.reviewKeys = 'on'
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      const key = event.key === 'ArrowRight' ? 'j' : event.key === 'ArrowLeft' ? 'k' : event.key.toLowerCase()
      const element = document.querySelector<HTMLElement>(`[data-key="${key}"]`)
      if (!element || (element as HTMLButtonElement).disabled) return
      event.preventDefault()
      element.click()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      delete document.documentElement.dataset.reviewKeys
      window.removeEventListener('keydown', onKey)
    }
  }, [])
  return null
}
