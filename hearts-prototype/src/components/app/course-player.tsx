'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { GardenTree, HeartIcon, ImageIcon, LockIcon, MicIcon, PauseIcon, PlayIcon } from '../icons'

export type PointView = {
  id: number
  number: number
  second: number
  prompt: string
  kind: 'reflection' | 'question' | 'multiple_choice' | 'task'
  options: string[]
  state: 'open' | 'waiting' | 'countdown'
  unlocksAt: string | null
  contingentPrompt?: string
  answered: boolean
  myAnswer?: string
}

export type SwarmItem = { name: string; body: string; image?: string | null }

type YTPlayer = { getCurrentTime(): number; getDuration(): number; pauseVideo(): void; playVideo(): void; seekTo(seconds: number, allow: boolean): void; destroy(): void }
type YTNamespace = { Player: new (el: HTMLElement, options: Record<string, unknown>) => YTPlayer; PlayerState: { ENDED: number; PLAYING: number; PAUSED: number } }
declare global {
  interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void }
}

function loadYouTube(): Promise<YTNamespace> {
  return new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT)
    const timer = window.setTimeout(() => reject(new Error('timeout')), 8000)
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      window.clearTimeout(timer)
      if (window.YT) resolve(window.YT)
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

function clock(total: number) {
  const value = Math.max(0, Math.floor(total))
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const seconds = value % 60
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`
}

const KIND_LABEL: Record<PointView['kind'], string> = { question: 'Question', task: 'Task', reflection: 'Reflection', multiple_choice: 'Multi-choice' }
const SUBMIT: Record<PointView['kind'], string> = { question: 'answer', task: 'task', reflection: 'reflection', multiple_choice: 'choice' }
const DOTS = ['#ef7b4a', '#1f8a78', '#7a4fa8', '#dca643', '#d94f68']

export function CoursePlayer({
  courseTitle,
  backHref,
  lessonId,
  partLabel,
  youtubeId,
  poster,
  duration,
  startAt,
  points,
  swarm,
  serverNow,
  next,
  garden,
}: {
  courseTitle: string
  backHref: string
  lessonId: number
  partLabel: string
  youtubeId: string | null
  poster: string | null
  duration: number
  startAt: number
  points: PointView[]
  swarm: Record<number, SwarmItem[]>
  serverNow: string
  next: string
  garden: { done: number; total: number; links: { label: string; href: string }[]; gardenHref: string }
}) {
  const holder = useRef<HTMLDivElement>(null)
  const player = useRef<YTPlayer | null>(null)
  const last = useRef(startAt)
  const fired = useRef(new Set<number>())
  const [mode, setMode] = useState<'loading' | 'youtube' | 'practice'>(youtubeId ? 'loading' : 'practice')
  const [time, setTime] = useState(startAt)
  const [furthest, setFurthest] = useState(startAt)
  const [length, setLength] = useState(duration)
  const [playing, setPlaying] = useState(false)
  const [ended, setEnded] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)
  const [now, setNow] = useState(() => new Date(serverNow).getTime())

  useEffect(() => {
    const timer = window.setInterval(() => setNow((value) => value + 1000), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!youtubeId || !holder.current) return
    let cancelled = false
    loadYouTube()
      .then((YT) => {
        if (cancelled || !holder.current) return
        player.current = new YT.Player(holder.current, {
          videoId: youtubeId,
          playerVars: { start: Math.floor(startAt), playsinline: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: () => {
              setMode('youtube')
              const total = player.current?.getDuration() || 0
              if (total > 0) setLength(total)
            },
            onStateChange: (event: { data: number }) => {
              setPlaying(event.data === YT.PlayerState.PLAYING)
              if (event.data === YT.PlayerState.ENDED) setEnded(true)
            },
          },
        })
      })
      .catch(() => !cancelled && setMode('practice'))
    return () => {
      cancelled = true
      player.current?.destroy()
      player.current = null
    }
  }, [youtubeId, startAt])

  useEffect(() => {
    if (mode === 'youtube') {
      const timer = window.setInterval(() => setTime(player.current?.getCurrentTime() || 0), 400)
      return () => window.clearInterval(timer)
    }
    if (mode === 'practice' && playing) {
      const timer = window.setInterval(() => setTime((value) => Math.min(length || Infinity, value + 1)), 1000)
      return () => window.clearInterval(timer)
    }
  }, [mode, playing, length])

  useEffect(() => {
    const previous = last.current
    last.current = time
    setFurthest((value) => Math.max(value, time))
    if (length && time >= length) setEnded(true)
    if (time < previous || time - previous > 5) return
    const crossed = points.find((point) => point.second > previous && point.second <= time && !fired.current.has(point.id))
    if (crossed) {
      fired.current.add(crossed.id)
      player.current?.pauseVideo()
      setPlaying(false)
      setOpenId(crossed.id)
    }
  }, [time, points, length])

  const togglePlay = () => {
    if (mode === 'youtube' && player.current) {
      if (playing) player.current.pauseVideo()
      else player.current.playVideo()
      return
    }
    setPlaying((value) => !value)
  }

  const nextPoint = points.find((point) => point.state === 'open' && !point.answered) || points.find((point) => !point.answered) || null
  const open = points.find((point) => point.id === openId) || null
  const total = length || Math.max(60, ...points.map((point) => point.second + 30))

  return (
    <div data-testid="player" data-mode={mode}>
      <div className="app-head" style={{ marginBottom: 6 }}>
        <Link className="back" href={backHref} data-testid="back">‹ {courseTitle}</Link>
      </div>
      <div className={`player-card${mode === 'youtube' ? ' yt-on' : ''}`} data-testid="player-card">
        {poster && mode !== 'youtube' ? <div className="poster" style={{ backgroundImage: `url(${poster})` }} /> : null}
        {youtubeId ? <div className="yt" style={{ display: mode === 'youtube' ? 'block' : 'none' }}><div ref={holder} /></div> : null}
        <span className="part-chip" data-testid="part-label">{partLabel}</span>
        <span className="time-read" data-testid="player-time">{clock(time)}</span>
        {open ? (
          <p className="paused-note">❚❚ paused at point {open.number}</p>
        ) : mode !== 'youtube' ? (
          <button type="button" className="big-play" aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlay} data-testid="player-play">
            {playing ? <PauseIcon size={30} /> : <PlayIcon size={30} />}
          </button>
        ) : null}
        <div className="timeline" data-testid="timeline">
          <div className="track" />
          <div className="fill" style={{ width: `${Math.min(100, (time / total) * 100)}%` }} />
          {points.map((point) => (
            <button
              key={point.id}
              type="button"
              className={`dot${point.answered ? ' done' : point.state !== 'open' ? ' locked' : ''}`}
              style={{ left: `${Math.min(98, Math.max(2, (point.second / total) * 100))}%` }}
              aria-label={`Point ${point.number} at ${clock(point.second)}`}
              data-testid="timeline-dot"
              data-state={point.state}
              data-second={point.second}
              onClick={() => {
                player.current?.pauseVideo()
                setPlaying(false)
                setOpenId(point.id)
              }}
            />
          ))}
        </div>
      </div>
      {mode === 'practice' ? (
        <p className="muted" style={{ fontSize: 13, margin: '8px 2px 0' }} data-testid="practice-note">
          {youtubeId ? 'The film could not load here, so the timeline runs on its own.' : 'This talk has no film link yet, so the timeline runs on its own.'} Press play and it will stop at each question.
        </p>
      ) : null}
      <button type="button" className="answer-btn" disabled={!nextPoint} onClick={() => nextPoint && setOpenId(nextPoint.id)} data-testid="answer-point">
        {nextPoint ? `Answer point ${nextPoint.number} →` : points.length ? 'All points answered' : 'No questions on this part yet'}
      </button>
      <section className="garden-card" data-testid="course-garden">
        <p className="eyebrow">Course garden</p>
        <div className="garden-grid">
          <GardenTree done={garden.done} total={garden.total} />
          <div>
            <h3>What&apos;s done</h3>
            <small data-testid="fruit-count">{garden.done} of {garden.total} fruits</small>
            <div className="bar"><i style={{ width: `${garden.total ? (garden.done / garden.total) * 100 : 0}%` }} /></div>
            {garden.links.map((link) => <Link key={link.href} className="garden-link" href={link.href}>↗ {link.label}</Link>)}
            <Link className="pill teal small" href={garden.gardenHref} style={{ marginTop: 6 }}>Open garden</Link>
          </div>
        </div>
      </section>
      <form className="watched-form" action="/api/hearts" method="post">
        <input type="hidden" name="action" value="complete" />
        <input type="hidden" name="lesson" value={lessonId} />
        <input type="hidden" name="seconds" value={Math.floor(furthest)} />
        {ended ? <input type="hidden" name="ended" value="yes" /> : null}
        <input type="hidden" name="next" value={next} />
        <button className="link-btn" type="submit" data-testid="mark-watched">I have watched this part</button>
      </form>
      {open ? <Sheet point={open} swarm={swarm[open.id] || []} now={now} next={next} onClose={() => setOpenId(null)} /> : null}
    </div>
  )
}

function Countdown({ unlocksAt, now }: { unlocksAt: string; now: number }) {
  let remaining = Math.max(0, new Date(unlocksAt).getTime() - now)
  const days = Math.floor(remaining / 86_400_000)
  remaining -= days * 86_400_000
  const hours = Math.floor(remaining / 3_600_000)
  remaining -= hours * 3_600_000
  const minutes = Math.floor(remaining / 60_000)
  const seconds = Math.floor((remaining - minutes * 60_000) / 1000)
  return (
    <div className="countdown" data-testid="countdown">
      <span><b>{days}</b>days</span><span><b>{hours}</b>hours</span><span><b>{minutes}</b>min</span><span><b>{seconds}</b>s</span>
    </div>
  )
}

function Sheet({ point, swarm, now, next, onClose }: { point: PointView; swarm: SwarmItem[]; now: number; next: string; onClose: () => void }) {
  const [keepPrivate, setKeepPrivate] = useState(true)
  const [recording, setRecording] = useState(false)
  const [audioName, setAudioName] = useState('')
  const [imageName, setImageName] = useState('')
  const [sending, setSending] = useState(false)
  const recorder = useRef<MediaRecorder | null>(null)
  const audioInput = useRef<HTMLInputElement>(null)

  const toggleRecord = async () => {
    if (recording) {
      recorder.current?.stop()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks: Blob[] = []
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = (event) => chunks.push(event.data)
      rec.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        const file = new File(chunks, 'voice-note.webm', { type: 'audio/webm' })
        const transfer = new DataTransfer()
        transfer.items.add(file)
        if (audioInput.current) audioInput.current.files = transfer.files
        setAudioName('Voice note ready')
        setRecording(false)
      }
      recorder.current = rec
      rec.start()
      setRecording(true)
    } catch {
      setAudioName('The microphone is not available. You can type instead.')
    }
  }

  return (
    <>
      <div className="sheet-scrim" onClick={onClose} />
      <section className="sheet" role="dialog" aria-label={point.prompt} data-testid="popup" data-state={point.state} data-point={point.id}>
        <div className="handle" />
        <button type="button" className="sheet-close" aria-label="Close" onClick={onClose} data-testid="popup-close">×</button>
        <div className="kind-tabs">
          {(Object.keys(KIND_LABEL) as PointView['kind'][]).map((kind) => <span key={kind} className={kind === point.kind ? 'on' : ''}>{KIND_LABEL[kind]}</span>)}
        </div>
        <h2 data-testid="popup-prompt">{point.prompt}</h2>
        {point.state === 'waiting' ? (
          <div className="lock-box" data-testid="locked">
            <LockIcon size={28} />
            <p data-testid="waiting">This question opens after you answer “{point.contingentPrompt || 'the earlier question'}”. Once you have, a short wait begins and you will see the time here.</p>
          </div>
        ) : null}
        {point.state === 'countdown' && point.unlocksAt ? (
          <div className="lock-box" data-testid="locked">
            <p style={{ margin: '0 0 4px', fontWeight: 700 }}>Time to unlock</p>
            <Countdown unlocksAt={point.unlocksAt} now={now} />
            <p>We will let you know in the app when it opens.</p>
          </div>
        ) : null}
        {point.state === 'open' && point.answered ? (
          <div className="card" style={{ background: 'var(--mint)', borderColor: '#cfe5db' }} data-testid="already-answered">
            <h3>Your answer</h3>
            <p>{point.myAnswer || 'Saved in your workbook.'}</p>
          </div>
        ) : null}
        {point.state === 'open' ? (
          <form action="/api/hearts" method="post" encType="multipart/form-data" onSubmit={() => setSending(true)} data-testid="answer-form">
            <input type="hidden" name="action" value="answer" />
            <input type="hidden" name="point" value={point.id} />
            <input type="hidden" name="next" value={next} />
            {point.kind === 'multiple_choice' && point.options.length ? (
              point.options.map((option) => (
                <label key={option} className="choice"><input type="radio" name="choice" value={option} required defaultChecked={point.myAnswer === option} /> {option}</label>
              ))
            ) : (
              <div className="compose">
                <textarea name="body" rows={2} placeholder="Type or record…" data-testid="answer-text" defaultValue={point.answered ? point.myAnswer : ''} />
                <button type="button" className={`mic${recording ? ' on' : ''}`} aria-label={recording ? 'Stop recording' : 'Record a voice note'} onClick={toggleRecord} data-testid="record"><MicIcon /></button>
              </div>
            )}
            <input ref={audioInput} type="file" name="audio" accept="audio/*" hidden />
            <label className="attach">
              <ImageIcon /> Add a photo
              <input type="file" name="image" accept="image/*" data-testid="answer-image" onChange={(event) => setImageName(event.target.files?.[0]?.name || '')} />
              {imageName ? <span className="attach-name">{imageName}</span> : null}
              {audioName ? <span className="attach-name">{audioName}</span> : null}
            </label>
            <label className="toggle"><input type="checkbox" name="keepPrivate" checked={keepPrivate} onChange={(event) => setKeepPrivate(event.target.checked)} data-testid="answer-private" /> Keep my answer private</label>
            <label className="toggle"><input type="checkbox" name="shareWithTeacher" data-testid="answer-share" /> Let my teacher read it</label>
            <button className="share-btn" type="submit" disabled={sending} data-testid="answer-submit">
              {sending ? 'Saving…' : `${keepPrivate ? 'Save' : 'Share'} my ${SUBMIT[point.kind]}`}
            </button>
          </form>
        ) : null}
        <div className="others" data-testid="swarm">
          <p className="eyebrow">What others said</p>
          {swarm.length ? (
            swarm.map((item, at) => (
              <div className="other" key={at} data-testid="swarm-item">
                <span className="dot" style={{ background: DOTS[at % DOTS.length] }} />
                <div>
                  <b>{item.name}</b>
                  <p>“{item.body}”</p>
                  {item.image ? <img src={item.image} alt={`Shared by ${item.name}`} /> : null}
                </div>
                <span className="heart"><HeartIcon size={18} /></span>
              </div>
            ))
          ) : (
            <p className="muted" style={{ fontSize: 14 }} data-testid="swarm-empty">Nobody has shared an answer here yet. Private answers never appear in this list.</p>
          )}
        </div>
      </section>
    </>
  )
}
