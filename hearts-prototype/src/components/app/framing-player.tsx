'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { FramingVariant } from '@/lib/experiments'
import { coverSourceToBox, cssVars, layoutFor } from '@/lib/framing/layout'
import { PLACEHOLDER_FACE } from '@/lib/framing/placeholder'
import { segmentAt } from '@/lib/framing/choose'
import { fallbackTrack } from '@/lib/framing/validate'
import { TRANSITION_MS, type FramingMode, type FramingTrack } from '@/lib/framing/types'
import { SpokenWords } from './spoken-words'
import { createPlayer, destroyPlayer, getPlayer, playOnly, soundOn, STATE, type YTPlayer } from '@/lib/yt'

export type FramingClock = { now(): number }

export const PLACEHOLDER_SRC = '/framing/placeholder.mp4'

type Props = {
  youtubeId: string
  track?: FramingTrack | null
  variant?: FramingVariant | string | null
  autoplay?: boolean
  sound?: boolean
  width?: number
  height?: number
  playerId?: string
  clock?: FramingClock
  onMode?: (mode: FramingMode, time: number) => void
  speaker?: string
  /** Talk title — passed through so F can refuse it as a stand-in for speech. */
  title?: string | null
  /** Local test-pattern film when YouTube cannot play. Labelled on screen. */
  placeholder?: boolean
}

export function effectiveMode(_track: FramingTrack | null | undefined, _time: number, _variant?: string | null): FramingMode {
  return 'F'
}

export function FramingPlayer({
  youtubeId,
  track,
  variant,
  autoplay = false,
  sound = false,
  width = 390,
  height = 844,
  playerId = 'framing-live',
  clock,
  onMode,
  speaker,
  title,
  placeholder = false,
}: Props) {
  const host = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const opened = useRef(false)
  const [ready, setReady] = useState(false)
  const [time, setTime] = useState(track && 'start' in track ? track.start : 0)
  const resolved = useMemo(() => track ?? fallbackTrack(youtubeId, 0, 30), [track, youtubeId])
  const mode = effectiveMode(resolved, time, variant)
  const segment = segmentAt(resolved, time)
  const layout = layoutFor(mode, width, height, segment?.crop, segment?.focus)
  const inWindow = time >= resolved.start - 0.75 && time < resolved.end
  const faceHit =
    placeholder && mode === 'D'
      ? coverSourceToBox(PLACEHOLDER_FACE, layout.film.width, layout.film.height, { x: layout.objectX, y: layout.objectY })
      : null

  useEffect(() => {
    if (placeholder) {
      setReady(true)
      const node = video.current
      if (node) {
        node.pause()
        if (autoplay) void node.play().catch(() => undefined)
      }
      return
    }
    if (!host.current) return
    let gone = false
    opened.current = false
    const openAtStart = (player: YTPlayer) => {
      if (player.loadVideoById) {
        player.loadVideoById({ videoId: youtubeId, startSeconds: resolved.start, endSeconds: resolved.end })
      } else {
        player.seekTo(resolved.start, true)
        if (autoplay) playOnly(playerId)
      }
      if (sound) soundOn(playerId)
    }
    void createPlayer({
      id: playerId,
      host: host.current,
      videoId: youtubeId,
      start: resolved.start,
      end: resolved.end,
      kind: 'hors',
      onReady: (next) => {
        if (gone) return
        const iframe = host.current?.querySelector('iframe')
        if (iframe) iframe.setAttribute('data-testid', 'framing-media')
        setReady(true)
        openAtStart(next)
      },
      onState: (state) => {
        const player = getPlayer(playerId)
        if (!player || gone) return
        if (state === STATE.PLAYING && sound) soundOn(playerId)
        if ((state === STATE.CUED || state === STATE.UNSTARTED) && autoplay) playOnly(playerId)
        if (state === STATE.PLAYING && !opened.current) {
          const now = player.getCurrentTime()
          if (now < resolved.start - 1 || now > resolved.start + 8) player.seekTo(resolved.start, true)
          opened.current = true
        }
        if (state === STATE.ENDED) {
          opened.current = false
          if (autoplay) openAtStart(player)
        }
      },
    })
    return () => {
      gone = true
      destroyPlayer(playerId)
    }
  }, [autoplay, placeholder, playerId, resolved.end, resolved.start, sound, youtubeId])

  useEffect(() => {
    let frame = 0
    const tick = () => {
      const player = getPlayer(playerId)
      const testClock = typeof window !== 'undefined' ? (window as unknown as { __frClock?: FramingClock }).__frClock : undefined
      const driven = clock?.now() ?? testClock?.now()
      if (placeholder && video.current && typeof driven === 'number' && Number.isFinite(driven)) {
        const node = video.current
        const duration = Number.isFinite(node.duration) && node.duration > 0 ? node.duration : 24
        let offset = driven - resolved.start
        offset = ((offset % duration) + duration) % duration
        if (Math.abs(node.currentTime - offset) > 0.08) node.currentTime = offset
        if (!autoplay && !node.paused) node.pause()
      }
      const fromVideo = placeholder && video.current && Number.isFinite(video.current.currentTime)
        ? resolved.start + video.current.currentTime
        : undefined
      const next = (typeof driven === 'number' && Number.isFinite(driven) ? driven : undefined) ?? fromVideo ?? player?.getCurrentTime()
      if (typeof next === 'number' && Number.isFinite(next)) setTime((held) => (Math.abs(held - next) < 0.04 ? held : next))
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [autoplay, clock, placeholder, playerId, resolved.start])

  useEffect(() => {
    onMode?.(mode, time)
  }, [mode, onMode, time])

  return (
    <div
      className={`fr-stage fr-${mode}`}
      data-testid="framing-player"
      data-framing-mode={mode}
      data-framing-ready={ready ? 'yes' : 'no'}
      data-framing-time={time.toFixed(2)}
      data-framing-window={inWindow ? 'in' : 'out'}
      data-framing-source={placeholder ? 'placeholder' : 'youtube'}
      style={{ width, height, ...cssVars(layout), ['--fr-ms' as string]: `${TRANSITION_MS}ms` }}
    >
      <div className="fr-bg" aria-hidden />
      {mode === 'C' ? (
        <div className="fr-blur" aria-hidden style={{ backgroundImage: `url(https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg)` }} />
      ) : null}
      <div className="fr-film" data-testid="framing-film">
        <div className="fr-crop">
          {placeholder ? (
            <video
              ref={video}
              className="fr-media"
              data-testid="framing-media"
              src={PLACEHOLDER_SRC}
              playsInline
              muted={!sound}
              loop
              autoPlay={autoplay}
              onLoadedData={() => setReady(true)}
            />
          ) : (
            <div ref={host} className="fr-host" data-testid="framing-host">
              {/* iframe is mounted here; testid is copied onto it after create */}
            </div>
          )}
        </div>
        {faceHit ? (
          <div
            data-testid="placeholder-face"
            className="fr-face-hit"
            style={{ left: faceHit.x, top: faceHit.y, width: faceHit.w, height: faceHit.h }}
          />
        ) : null}
      </div>
      {placeholder ? <p className="fr-placeholder-mark">Placeholder — not YouTube</p> : null}
      {mode === 'E' ? (
        <div className="fr-card-meta">
          <b>{speaker || 'The talk'}</b>
          <i />
        </div>
      ) : null}
      {mode === 'F' ? (
        <SpokenWords
          sentences={resolved.sentences || []}
          time={time}
          speaker={speaker}
          title={title}
          from={resolved.start}
          to={resolved.end}
        />
      ) : null}
    </div>
  )
}
