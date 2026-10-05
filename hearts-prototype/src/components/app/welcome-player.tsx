'use client'

import { useState } from 'react'
import { spokenWordsAt, type SpokenCue } from '@/lib/welcome-films'

export function WelcomePlayer({
  src,
  embed,
  captions = [],
}: {
  src?: string
  embed?: string
  captions?: SpokenCue[]
}) {
  const [words, setWords] = useState('')

  if (embed) {
    return (
      <div className="welcome-player" data-testid="welcome-player" data-kind="embed">
        <iframe className="film-frame" title="" src={embed} allow="encrypted-media; autoplay" />
      </div>
    )
  }

  if (!src) return null

  return (
    <div className="welcome-player" data-testid="welcome-player" data-kind="file">
      <video
        className="film-frame"
        src={src}
        controls
        playsInline
        autoPlay
        onTimeUpdate={(event) => setWords(spokenWordsAt(captions, event.currentTarget.currentTime))}
      />
      {words ? (
        <p className="welcome-spoken" data-testid="welcome-caption">
          {words}
        </p>
      ) : null}
    </div>
  )
}
