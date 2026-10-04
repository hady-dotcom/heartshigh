'use client'

import { useMemo, useState } from 'react'
import { FramingPlayer } from '@/components/app/framing-player'
import { MODE_COLOUR, MODE_LABEL, FRAMING_MODES, type FramingMode, type FramingTrack } from '@/lib/framing/types'

function clock(total: number) {
  const value = Math.max(0, Math.round(total))
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}

export function FramingPreview({
  track,
  youtubeId,
  speaker,
  cutId,
  next,
}: {
  track: FramingTrack
  youtubeId: string
  speaker?: string
  cutId?: number
  next: string
}) {
  const span = Math.max(0.1, track.end - track.start)
  const [index, setIndex] = useState(0)
  const [mode, setMode] = useState<FramingMode>(track.segments[0]?.mode || 'F')
  const [play, setPlay] = useState(false)
  const chosen = track.segments[index] || track.segments[0]
  const preview = useMemo(() => {
    if (!chosen) return track
    return { ...track, segments: track.segments.map((row, at) => (at === index ? { ...row, mode } : row)) }
  }, [chosen, index, mode, track])

  return (
    <div className="fr-desk" data-testid="framing-preview">
      <div className="fr-timeline" data-testid="framing-timeline" role="list">
        {track.segments.map((segment, at) => (
          <button
            key={`${segment.start}:${segment.mode}:${at}`}
            type="button"
            className={`fr-seg${at === index ? ' on' : ''}`}
            role="listitem"
            data-testid="framing-segment"
            data-mode={segment.mode}
            style={{ flex: `${Math.max(segment.end - segment.start, 0.4)} 1 0`, background: MODE_COLOUR[segment.mode] }}
            onClick={() => {
              setIndex(at)
              setMode(segment.mode)
            }}
          >
            {segment.mode}
          </button>
        ))}
      </div>
      <p className="fr-legend">
        {FRAMING_MODES.map((name) => (
          <span key={name}><i style={{ background: MODE_COLOUR[name] }} />{name} {MODE_LABEL[name]}</span>
        ))}
      </p>
      {chosen ? (
        <p className="hint" data-testid="framing-segment-meta">
          {clock(chosen.start)} to {clock(chosen.end)} · {MODE_LABEL[chosen.mode]} · confidence {chosen.confidence.toFixed(2)}
        </p>
      ) : null}
      {cutId ? (
        <form className="form" action="/api/hearts" method="post" data-testid="framing-override" style={{ marginTop: 12 }}>
          <input type="hidden" name="action" value="framing-override" />
          <input type="hidden" name="cut" value={cutId} />
          <input type="hidden" name="index" value={index} />
          <input type="hidden" name="next" value={next} />
          <label className="stack">
            Override this segment
            <select name="mode" value={mode} onChange={(event) => setMode(event.target.value as FramingMode)} data-testid="framing-mode-select">
              {FRAMING_MODES.map((name) => (
                <option key={name} value={name}>{name} · {MODE_LABEL[name]}</option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button className="btn teal small" type="submit" data-testid="framing-save">Save override</button>
            <button className="btn ghost small" type="button" onClick={() => setPlay(true)} data-testid="framing-play">Play through</button>
          </div>
        </form>
      ) : (
        <div className="actions" style={{ marginTop: 12 }}>
          <button className="btn teal small" type="button" onClick={() => setPlay(true)} data-testid="framing-play">Play through</button>
        </div>
      )}
      <div className="fr-phone" style={{ marginTop: 16 }}>
        <FramingPlayer
          youtubeId={youtubeId}
          track={preview}
          speaker={speaker}
          autoplay={play}
          sound={play}
          playerId={`desk-framing-${cutId || youtubeId}-${play ? 'on' : 'off'}`}
        />
      </div>
      <p className="hint">The film stays on YouTube. This preview only moves the live crop. Clip span {clock(span)}.</p>
    </div>
  )
}
