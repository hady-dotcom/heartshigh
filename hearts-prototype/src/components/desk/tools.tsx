'use client'

import { useEffect, useRef, useState } from 'react'

function clock(total: number) {
  const value = Math.max(0, Math.floor(total))
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const seconds = value % 60
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`
}

type YTPlayer = { getCurrentTime(): number; pauseVideo(): void; destroy(): void }
type YTNamespace = { Player: new (el: HTMLElement, options: Record<string, unknown>) => YTPlayer }

function loadYouTube(): Promise<YTNamespace> {
  const w = window as unknown as { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void }
  return new Promise((resolve, reject) => {
    if (w.YT?.Player) return resolve(w.YT)
    const timer = window.setTimeout(() => reject(new Error('timeout')), 8000)
    const previous = w.onYouTubeIframeAPIReady
    w.onYouTubeIframeAPIReady = () => {
      previous?.()
      window.clearTimeout(timer)
      if (w.YT) resolve(w.YT)
    }
    if (!document.querySelector('script[data-yt-api]')) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.dataset.ytApi = 'yes'
      script.onerror = () => reject(new Error('blocked'))
      document.head.appendChild(script)
    }
  })
}

/** Preview the film and pause where the question belongs; the second fills itself. Falls back to a plain clock when YouTube cannot load. */
export function PointPicker({ youtubeId, initial = 0 }: { youtubeId: string | null; initial?: number }) {
  const holder = useRef<HTMLDivElement>(null)
  const player = useRef<YTPlayer | null>(null)
  const [second, setSecond] = useState(initial)
  const [ready, setReady] = useState(false)
  const [ticking, setTicking] = useState(false)

  useEffect(() => {
    if (!youtubeId || !holder.current) return
    let cancelled = false
    loadYouTube()
      .then((YT) => {
        if (cancelled || !holder.current) return
        player.current = new YT.Player(holder.current, { videoId: youtubeId, playerVars: { rel: 0, modestbranding: 1 }, events: { onReady: () => setReady(true) } })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      player.current?.destroy()
    }
  }, [youtubeId])

  useEffect(() => {
    if (!ticking) return
    const timer = window.setInterval(() => setSecond((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [ticking])

  const useMoment = () => {
    if (ready && player.current) {
      player.current.pauseVideo()
      setSecond(Math.floor(player.current.getCurrentTime()))
    } else setTicking(false)
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {youtubeId ? <div className="film-preview" style={{ padding: 0, overflow: 'hidden', display: ready ? 'block' : 'grid' }}><div ref={holder} style={{ width: '100%', height: '100%' }} />{!ready ? <span>Loading the film…</span> : null}</div> : null}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {!ready ? <button type="button" className="btn ghost small" data-testid="preview-play" onClick={() => setTicking(true)}>Start the clock</button> : null}
        <button type="button" className="btn small" data-testid="preview-pause" onClick={useMoment}>Use this moment</button>
        <span className="address" data-testid="preview-readout" style={{ padding: '6px 10px' }}>{clock(second)}</span>
        <label className="check">Second <input type="number" min={0} name="second" value={second} onChange={(event) => setSecond(Math.max(0, Number(event.target.value) || 0))} data-testid="point-timestamp" style={{ width: 110 }} /></label>
      </div>
    </div>
  )
}

type Mark = { id: number; second: number; body: string; author: string }

/** Mentor feedback on a learner's video or voice evidence: notes sit on the timeline at the moment they refer to. */
export function EvidencePlayer({ src, kind, marks, answerId, next, href }: { src: string | null; kind: 'video' | 'audio' | 'none'; marks: Mark[]; answerId: number; next: string; href: string }) {
  const media = useRef<HTMLVideoElement & HTMLAudioElement>(null)
  const [time, setTime] = useState(0)
  const [length, setLength] = useState(Math.max(30, ...marks.map((mark) => mark.second + 5)))
  const seek = (second: number) => {
    if (media.current) {
      media.current.currentTime = second
      media.current.pause()
    }
    setTime(second)
  }
  return (
    <div>
      {kind === 'video' && src ? (
        <video ref={media} src={src} controls onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)} onLoadedMetadata={(event) => event.currentTarget.duration && setLength(event.currentTarget.duration)} data-testid="evidence-media" />
      ) : kind === 'audio' && src ? (
        <audio ref={media} src={src} controls style={{ width: '100%' }} onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)} onLoadedMetadata={(event) => event.currentTarget.duration && setLength(event.currentTarget.duration)} data-testid="evidence-media" />
      ) : (
        <div className="film-preview">No recording was attached, so notes are placed against the written answer.</div>
      )}
      <div className="scrub" aria-label="Feedback timeline">
        <div className="track" />
        {marks.map((mark) => (
          <button key={mark.id} type="button" className="mark" style={{ left: `${Math.min(98, (mark.second / length) * 100)}%` }} onClick={() => seek(mark.second)} aria-label={`Note at ${clock(mark.second)}`} />
        ))}
      </div>
      <div className="mark-list">
        {marks.map((mark) => (
          <div className="mark-item" key={mark.id} data-testid="feedback-mark">
            <button type="button" className="at" onClick={() => seek(mark.second)}>{clock(mark.second)}</button>
            <span><b style={{ fontSize: 13 }}>{mark.author}</b><br />{mark.body}</span>
          </div>
        ))}
      </div>
      <form className="feedback-bar" action="/api/hearts" method="post" encType="multipart/form-data">
        <input type="hidden" name="action" value="feedback" />
        <input type="hidden" name="answer" value={answerId} />
        <input type="hidden" name="href" value={href} />
        <input type="hidden" name="next" value={next} />
        <span className="stamp" data-testid="feedback-stamp">at {clock(time)}</span>
        <input type="number" name="second" min={0} value={Math.floor(time)} onChange={(event) => setTime(Number(event.target.value) || 0)} style={{ width: 90 }} aria-label="Second" data-testid="feedback-second" />
        <input type="text" name="body" placeholder="Write a note for this moment" required data-testid="feedback-body" />
        <button className="btn ink" type="submit" data-testid="feedback-submit">Add note</button>
      </form>
    </div>
  )
}
