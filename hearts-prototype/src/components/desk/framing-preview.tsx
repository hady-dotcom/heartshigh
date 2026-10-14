'use client'

import { useMemo, useRef, useState } from 'react'
import { FramingPlayer, type FramingClock } from '@/components/app/framing-player'
import { faceSample, faceTrackingRan, FACE_TRACK_NOTE } from '@/lib/framing/learner'
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
  placeholder = false,
}: {
  track: FramingTrack
  youtubeId: string
  speaker?: string
  cutId?: number
  next: string
  /** Local film in tests, so the crop is visible without YouTube. Learners still use the same player. */
  placeholder?: boolean
}) {
  const span = Math.max(0.1, track.end - track.start)
  const faceRan = faceTrackingRan(track)
  const [index, setIndex] = useState(0)
  const [labMode, setLabMode] = useState<FramingMode>(track.segments[0]?.mode === 'D' && !faceRan ? 'F' : track.segments[0]?.mode || 'F')
  const [play, setPlay] = useState(false)
  const chosen = track.segments[index] || track.segments[0]
  const labAt = useRef(track.start)
  labAt.current = (chosen?.start ?? track.start) + 0.05
  const labClock = useMemo<FramingClock>(() => ({ now: () => labAt.current }), [])
  const labTrack = useMemo(() => {
    const sample = labMode === 'D' ? faceSample(track, chosen) : null
    return {
      ...track,
      segments: track.segments.map((row, at) => {
        if (at !== index) return row
        return { ...row, mode: labMode, ...(sample?.crop ? { crop: sample.crop, focus: sample.focus } : {}) }
      }),
    }
  }, [chosen, index, labMode, track])

  return (
    <div className="fr-desk" data-testid="framing-preview">
      <p className="fr-plain" data-testid="framing-explainer">
        This page shows how a clip sits on a phone. Learners always get the same picture: the whole wide video in a band at the top, and the words underneath, lighting up as they are said. That is the only crop on learner video.
      </p>
      <p className="fr-phone-label">What learners see</p>
      <div className="fr-phone-slot" data-testid="learner-preview" data-learner-mode="F">
        <div className="fr-phone">
          <FramingPlayer
            youtubeId={youtubeId}
            track={track}
            speaker={speaker}
            autoplay={play}
            sound={play}
            placeholder={placeholder}
            playerId={`desk-learner-${cutId || youtubeId}-${play ? 'on' : 'off'}`}
          />
        </div>
      </div>
      <p className="hint">Wide video on top. Words below. Clip length {clock(span)}.</p>
      <div className="actions" style={{ marginTop: 12 }}>
        <button className="btn teal small" type="button" onClick={() => setPlay(true)} data-testid="framing-play">Play through</button>
      </div>

      <details className="fr-techies" data-testid="for-techies">
        <summary>For techies</summary>
        <p className="fr-plain">
          Centre crop, letterbox, blurred fill, face track and the 4:5 card are experiments. A learner&apos;s phone does not use them. The lab picture updates as soon as you pick one. Save override stores the try on this clip. Learners still get the wide video and the words.
        </p>
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
                setLabMode(segment.mode === 'D' && !faceRan ? 'F' : segment.mode)
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
            {clock(chosen.start)} to {clock(chosen.end)} · stored as {MODE_LABEL[chosen.mode]}
            {chosen.confidence > 0 ? ` · confidence ${chosen.confidence.toFixed(2)}` : ''}
          </p>
        ) : null}
        {cutId ? (
          <form className="form" action="/api/hearts" method="post" data-testid="framing-override" style={{ marginTop: 12 }}>
            <input type="hidden" name="action" value="framing-override" />
            <input type="hidden" name="cut" value={cutId} />
            <input type="hidden" name="index" value={index} />
            <input type="hidden" name="next" value={next} />
            <label className="stack">
              Try a crop on this piece
              <select name="mode" value={labMode} onChange={(event) => setLabMode(event.target.value as FramingMode)} data-testid="framing-mode-select">
                {FRAMING_MODES.map((name) => (
                  <option key={name} value={name} disabled={name === 'D' && !faceRan}>
                    {name} · {MODE_LABEL[name]}{name === 'D' && !faceRan ? ' (not run)' : ''}
                  </option>
                ))}
              </select>
            </label>
            {faceRan ? null : <p className="fr-face-note" data-testid="face-track-note">{FACE_TRACK_NOTE}</p>}
            <div className="actions">
              <button className="btn teal small" type="submit" data-testid="framing-save">Save override</button>
            </div>
          </form>
        ) : null}
        <p className="fr-phone-label">Lab look. Learners do not see this.</p>
        <div className="fr-phone-slot" data-testid="lab-preview" data-lab-mode={labMode}>
          <div className="fr-phone">
            <FramingPlayer
              youtubeId={youtubeId}
              track={labTrack}
              speaker={speaker}
              autoplay={false}
              sound={false}
              placeholder={placeholder}
              labMode={labMode}
              clock={labClock}
              playerId={`desk-lab-${cutId || youtubeId}`}
            />
          </div>
        </div>
      </details>
    </div>
  )
}
