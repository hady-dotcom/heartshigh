'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { activeRole, kineticClock, kineticLines, kineticWindow, type KineticRole } from '@/lib/kinetic-lines'
import { createPlayer, type YTPlayer } from '@/lib/yt'

type Background = 'gradient' | 'mask' | 'solid'
type Mask = 'arch' | 'circle' | 'diamond' | 'window'
type Solid = 'ground' | 'night' | 'plum' | 'cream'
type Gradient = 'dusk' | 'oasis' | 'nightgold'

const BACKGROUNDS: { id: Background; name: string }[] = [
  { id: 'gradient', name: 'Gradient' },
  { id: 'mask', name: 'Mask' },
  { id: 'solid', name: 'Solid' },
]
const MASKS: { id: Mask; name: string }[] = [
  { id: 'arch', name: 'Arch' },
  { id: 'circle', name: 'Circle' },
  { id: 'diamond', name: 'Diamond' },
  { id: 'window', name: 'Window' },
]
const SOLIDS: { id: Solid; name: string }[] = [
  { id: 'ground', name: 'Ground' },
  { id: 'night', name: 'Night' },
  { id: 'plum', name: 'Plum' },
  { id: 'cream', name: 'Cream' },
]
const GRADIENTS: { id: Gradient; name: string }[] = [
  { id: 'dusk', name: 'Dusk' },
  { id: 'oasis', name: 'Oasis' },
  { id: 'nightgold', name: 'Night gold' },
]
const ROLES: { id: KineticRole; name: string }[] = [
  { id: 'hook', name: 'Hook' },
  { id: 'turn', name: 'Turn' },
  { id: 'land', name: 'Land' },
]

/** The same hors d'oeuvre as text. One line at a time, on the talk's audio, over a graphic background. */
export function KineticPreview({
  youtubeId,
  hook,
  turn,
  land,
  hookAt,
  turnAt,
  landAt,
  appetiserStart,
  appetiserEnd,
}: {
  youtubeId: string | null
  hook: string
  turn: string
  land: string
  hookAt?: number | null
  turnAt?: number | null
  landAt?: number | null
  appetiserStart: number
  appetiserEnd: number
}) {
  const lines = useMemo(
    () => kineticLines({ hook, turn, land, hookAt, turnAt, landAt, appetiserStart, appetiserEnd }),
    [hook, turn, land, hookAt, turnAt, landAt, appetiserStart, appetiserEnd],
  )
  const span = useMemo(() => kineticWindow(lines, appetiserEnd), [lines, appetiserEnd])
  const [bg, setBg] = useState<Background>('gradient')
  const [mask, setMask] = useState<Mask>('arch')
  const [solid, setSolid] = useState<Solid>('ground')
  const [gradient, setGradient] = useState<Gradient>('dusk')
  const [t, setT] = useState(span.start)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const timeRef = useRef(span.start)
  const playingRef = useRef(false)
  const spanRef = useRef(span)
  timeRef.current = t
  playingRef.current = playing
  spanRef.current = span
  const role = activeRole(lines, t)

  useEffect(() => {
    setT(span.start)
  }, [span.start])

  useEffect(() => {
    let timer = 0
    let dead = false
    const host = audioRef.current
    if (!playing || !host) return
    const stop = () => {
      dead = true
      window.clearInterval(timer)
    }
    const follow = (player: YTPlayer) => {
      timer = window.setInterval(() => {
        if (dead) return
        let now = spanRef.current.start
        try { now = player.getCurrentTime() } catch { return }
        const end = spanRef.current.end
        if (now >= end - 0.05) {
          try { player.seekTo(spanRef.current.start, true) } catch { /* the film may have ended */ }
          setT(spanRef.current.start)
          return
        }
        setT(now)
      }, 100)
    }
    const local = () => {
      const origin = performance.now()
      const originTime = timeRef.current
      timer = window.setInterval(() => {
        if (dead || !playingRef.current) return
        const next = originTime + (performance.now() - origin) / 1000
        if (next >= spanRef.current.end) setT(spanRef.current.start)
        else setT(next)
      }, 100)
    }
    if (!youtubeId) {
      local()
      return stop
    }
    const existing = playerRef.current
    if (existing) {
      try {
        existing.seekTo(timeRef.current, true)
        existing.playVideo()
      } catch { /* cue again below if the player has gone */ }
      follow(existing)
      return stop
    }
    let player: YTPlayer | null = null
    createPlayer({
      id: 'kinetic-desk',
      host,
      videoId: youtubeId,
      start: timeRef.current,
      end: span.end,
      kind: 'hors',
      onReady: (ready) => {
        if (dead) {
          try { ready.destroy() } catch { /* already gone */ }
          return
        }
        player = ready
        playerRef.current = ready
        try {
          ready.seekTo(timeRef.current, true)
          ready.playVideo()
        } catch { /* the clock below still moves the line */ }
      },
      onError: () => undefined,
    }).then((ready) => {
      if (dead) return
      player = ready
      follow(ready)
    }).catch(() => {
      if (!dead) local()
    })
    return () => {
      stop()
      if (player && player === playerRef.current) {
        try { player.pauseVideo() } catch { /* unmounted */ }
      }
    }
  }, [playing, youtubeId, span.end])

  useEffect(() => () => {
    const player = playerRef.current
    playerRef.current = null
    try { player?.destroy() } catch { /* already gone */ }
  }, [])

  function seek(at: number) {
    const next = Math.max(span.start, Math.min(span.end, at))
    setT(next)
    try { playerRef.current?.seekTo(next, true) } catch { /* the line still moves */ }
  }

  const byRole = Object.fromEntries(lines.map((line) => [line.role, line])) as Record<KineticRole, (typeof lines)[number]>

  return (
    <div className="kinetic-desk" data-testid="kinetic-preview">
      <p className="hint kinetic-desk-note">The same moment, as text. Hook, then turn, then land, each while that line is being said. The picture stays off.</p>
      <div className="kinetic-stage" data-testid="kinetic-stage" data-beat={role} data-bg={bg} data-mask={mask} data-solid={solid} data-gradient={gradient} data-playing={playing ? '1' : ''} data-t={t.toFixed(2)} data-hook-at={byRole.hook.at} data-turn-at={byRole.turn.at} data-land-at={byRole.land.at} data-light={bg === 'solid' && solid === 'cream' ? '1' : ''}>
        <div className="kinetic-bg" />
        <div className="kinetic-mask" />
        <div className="kinetic-audio" data-testid="kinetic-audio" ref={audioRef} />
        {ROLES.map(({ id }) => (
          <p key={id} className={`kinetic-line kinetic-line-${id}${role === id ? ' now' : ''}`} data-role={id} hidden={role !== id}>{byRole[id].text || '—'}</p>
        ))}
        <div className="kinetic-clock">{kineticClock(t)}</div>
        <button type="button" className="kinetic-play" data-testid="kinetic-play" onClick={() => setPlaying((on) => !on)}>{playing ? 'Pause' : 'Play'}</button>
      </div>
      <input className="kinetic-scrub" type="range" min={span.start} max={span.end} step={0.1} value={Math.min(span.end, Math.max(span.start, t))} aria-label="Moment" data-testid="kinetic-scrub" onChange={(event) => seek(Number(event.target.value))} />
      <div className="kinetic-jumps" data-testid="kinetic-jumps">
        {ROLES.map(({ id, name }) => (
          <button key={id} type="button" className={role === id ? 'on' : ''} data-testid={`kinetic-jump-${id}`} onClick={() => seek(byRole[id].at)}>
            {name}<span>{kineticClock(byRole[id].at)}</span>
          </button>
        ))}
      </div>
      <div className="kinetic-picks" data-testid="kinetic-backgrounds">
        {BACKGROUNDS.map((item) => (
          <button key={item.id} type="button" className={bg === item.id ? 'on' : ''} data-testid={`kinetic-bg-${item.id}`} onClick={() => setBg(item.id)}>{item.name}</button>
        ))}
      </div>
      {bg === 'gradient' ? (
        <div className="kinetic-picks">
          {GRADIENTS.map((item) => (
            <button key={item.id} type="button" className={gradient === item.id ? 'on' : ''} data-testid={`kinetic-gradient-${item.id}`} onClick={() => setGradient(item.id)}>{item.name}</button>
          ))}
        </div>
      ) : null}
      {bg === 'mask' ? (
        <div className="kinetic-picks">
          {MASKS.map((item) => (
            <button key={item.id} type="button" className={mask === item.id ? 'on' : ''} data-testid={`kinetic-mask-${item.id}`} onClick={() => setMask(item.id)}>{item.name}</button>
          ))}
        </div>
      ) : null}
      {bg === 'solid' ? (
        <div className="kinetic-picks">
          {SOLIDS.map((item) => (
            <button key={item.id} type="button" className={solid === item.id ? 'on' : ''} data-testid={`kinetic-solid-${item.id}`} onClick={() => setSolid(item.id)}>{item.name}</button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
