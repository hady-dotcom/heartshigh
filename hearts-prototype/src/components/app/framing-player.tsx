'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { framingVariant, type FramingVariant } from '@/lib/experiments'
import { cssVars, layoutFor } from '@/lib/framing/layout'
import { segmentAt } from '@/lib/framing/choose'
import { fallbackTrack } from '@/lib/framing/validate'
import { TRANSITION_MS, type FramingMode, type FramingTrack } from '@/lib/framing/types'
import { SpokenWords } from './spoken-words'
import { createPlayer, destroyPlayer, getPlayer, playOnly, soundOn, STATE, type YTPlayer } from '@/lib/yt'

export type FramingClock = { now(): number }

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
}

export function effectiveMode(track: FramingTrack | null | undefined, time: number, variant?: string | null): FramingMode {
  if (framingVariant(variant) === 'split-only') return 'F'
  return segmentAt(track, time)?.mode || 'F'
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
}: Props) {
  const host = useRef<HTMLDivElement>(null)
  const opened = useRef(false)
  const [ready, setReady] = useState(false)
  const [time, setTime] = useState(track?.start ?? 0)
  const resolved = useMemo(() => track || fallbackTrack(youtubeId, track?.start ?? 0, track?.end ?? 30), [track, youtubeId])
  const mode = effectiveMode(resolved, time, variant)
  const segment = segmentAt(resolved, time)
  const layout = layoutFor(mode, width, height, segment?.crop, segment?.focus)
  const inWindow = time >= resolved.start - 0.75 && time < resolved.end

  useEffect(() => {
    if (!host.current) return
    let gone = false
    opened.current = false
    const openAtStart = (player: YTPlayer) => {
      player.seekTo(resolved.start, true)
      if (sound) soundOn(playerId)
      if (autoplay) playOnly(playerId)
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
  }, [autoplay, playerId, resolved.end, resolved.start, sound, youtubeId])

  useEffect(() => {
    if (!ready || !autoplay) return
    let tries = 0
    const id = window.setInterval(() => {
      const player = getPlayer(playerId)
      if (!player) return
      const now = player.getCurrentTime()
      const state = player.getPlayerState()
      if (state === STATE.CUED || state === STATE.UNSTARTED || state === STATE.ENDED) playOnly(playerId)
      if (now < resolved.start - 1.5 || now >= resolved.end) {
        player.seekTo(resolved.start, true)
        player.playVideo()
      }
      if (++tries > 8) window.clearInterval(id)
    }, 800)
    return () => window.clearInterval(id)
  }, [autoplay, playerId, ready, resolved.end, resolved.start])

  useEffect(() => {
    let frame = 0
    const tick = () => {
      const player = getPlayer(playerId)
      const testClock = typeof window !== 'undefined' ? (window as unknown as { __frClock?: FramingClock }).__frClock : undefined
      const next = clock?.now() ?? testClock?.now() ?? player?.getCurrentTime()
      if (typeof next === 'number' && Number.isFinite(next)) setTime((held) => (Math.abs(held - next) < 0.04 ? held : next))
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [clock, playerId])

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
      style={{ width, height, ...cssVars(layout), ['--fr-ms' as string]: `${TRANSITION_MS}ms` }}
    >
      <div className="fr-bg" aria-hidden />
      {mode === 'C' ? (
        <div className="fr-blur" aria-hidden style={{ backgroundImage: `url(https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg)` }} />
      ) : null}
      <div className="fr-film" data-testid="framing-film">
        <div className="fr-crop">
          <div ref={host} className="fr-host yt-host" data-testid="framing-host" />
        </div>
      </div>
      {mode === 'E' ? (
        <div className="fr-card-meta">
          <b>{speaker || 'The talk'}</b>
          <i />
        </div>
      ) : null}
      {mode === 'F' ? <SpokenWords sentences={resolved.sentences || []} time={time} speaker={speaker} /> : null}
    </div>
  )
}
