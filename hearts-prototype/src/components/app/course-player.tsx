'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { newViewingId, POLL_MS, PopupWatcher, type PopupPoint } from '@/lib/popups'
import { createPlayer, destroyPlayer, getPlayer, resume, STATE, UNPLAYABLE } from '@/lib/yt'
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
  timeLimitSec?: number | null
}

export type SwarmItem = { name: string; body: string; image?: string | null }

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

const PLAYER_ID = 'lesson'

function asPopup(point: PointView, lessonId: number): PopupPoint {
  return { ...point, triggerType: 'timestamp', atSecond: point.second, lessonId }
}

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
  swarmOn = false,
  serverNow,
  next,
  garden,
  overPlayer = true,
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
  /** The learner opted in to sharing with other learners, so the swarm and its share box are shown. */
  swarmOn?: boolean
  serverNow: string
  next: string
  garden: { done: number; total: number; links: { label: string; href: string }[]; gardenHref: string }
  /** Master flag popupOverPlayer. Off is the strict layout: the paused player stays fully in view. */
  overPlayer?: boolean
}) {
  const router = useRouter()
  const card = useRef<HTMLDivElement>(null)
  const holder = useRef<HTMLDivElement>(null)
  const watcher = useRef<PopupWatcher | null>(null)
  const viewing = useRef('')
  const queue = useRef<number[]>([])
  const [mode, setMode] = useState<'loading' | 'youtube' | 'practice'>(youtubeId ? 'loading' : 'practice')
  const [time, setTime] = useState(startAt)
  const [furthest, setFurthest] = useState(startAt)
  const [length, setLength] = useState(duration)
  const [playing, setPlaying] = useState(false)
  const [ended, setEnded] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)
  const [fromTrigger, setFromTrigger] = useState(false)
  const [sheetTop, setSheetTop] = useState<number | null>(null)
  const [answered, setAnswered] = useState<Record<number, string>>({})
  const [notice, setNotice] = useState('')
  const [now, setNow] = useState(() => new Date(serverNow).getTime())

  const views = points.map((point) => (answered[point.id] !== undefined ? { ...point, answered: true, myAnswer: answered[point.id] } : point))
  const viewsRef = useRef(views)
  viewsRef.current = views

  if (!watcher.current) watcher.current = new PopupWatcher([])
  useEffect(() => {
    watcher.current?.setPoints(views.filter((point) => point.state === 'open' && !point.answered).map((point) => asPopup(point, lessonId)))
  })

  useEffect(() => {
    viewing.current = newViewingId()
    watcher.current?.startViewing(viewing.current, startAt)
  }, [startAt])

  useEffect(() => {
    const timer = window.setInterval(() => setNow((value) => value + 1000), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!youtubeId || !holder.current) return
    let cancelled = false
    const fallback = window.setTimeout(() => !cancelled && setMode((value) => (value === 'loading' ? 'practice' : value)), 9000)
    createPlayer({
      id: PLAYER_ID,
      host: holder.current,
      videoId: youtubeId,
      start: startAt,
      kind: 'full',
      onReady: (player) => {
        if (cancelled) return
        window.clearTimeout(fallback)
        setMode('youtube')
        const total = player.getDuration() || 0
        if (total > 0) setLength(total)
      },
      onState: (state) => {
        setPlaying(state === STATE.PLAYING)
        if (state === STATE.ENDED) setEnded(true)
      },
      onError: (code) => UNPLAYABLE.has(code) && !cancelled && setMode('practice'),
    }).catch(() => !cancelled && setMode('practice'))
    return () => {
      cancelled = true
      window.clearTimeout(fallback)
      destroyPlayer(PLAYER_ID)
    }
  }, [youtubeId, startAt])

  // The sheet never covers the film: default keeps the paused video in view above it, strict keeps the whole player clear.
  const placeSheet = useCallback(() => {
    // Lock scrolling before measuring: dropping the scrollbar can reflow the player by a few pixels.
    document.documentElement.style.overflow = 'hidden'
    card.current?.scrollIntoView({ block: 'start' })
    const rect = card.current?.getBoundingClientRect()
    const film = mode === 'youtube' ? holder.current?.getBoundingClientRect() : null
    setSheetTop(rect ? Math.max(8, overPlayer && film ? film.bottom : rect.bottom) : null)
  }, [overPlayer, mode])

  const show = useCallback(
    (id: number, triggered: boolean) => {
      placeSheet()
      setFromTrigger(triggered)
      setOpenId(id)
    },
    [placeSheet],
  )

  // The player changes shape once YouTube is ready, so a sheet opened before that moves with it.
  useEffect(() => {
    if (openId === null) return
    const frame = window.requestAnimationFrame(placeSheet)
    window.addEventListener('resize', placeSheet)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', placeSheet)
    }
  }, [openId, placeSheet])

  useEffect(() => {
    if (openId === null) return
    return () => {
      document.documentElement.style.overflow = ''
    }
  }, [openId])

  const pause = () => {
    getPlayer(PLAYER_ID)?.pauseVideo()
    setPlaying(false)
  }

  useEffect(() => {
    if (!playing || openId !== null) return
    const timer = window.setInterval(() => {
      const at = mode === 'youtube' ? getPlayer(PLAYER_ID)?.getCurrentTime() || 0 : null
      setTime((value) => {
        const current = at ?? Math.min(length || Infinity, value + POLL_MS / 1000)
        const due = watcher.current?.tick(current) || []
        if (due.length) {
          pause()
          queue.current = due.slice(1).map((point) => point.id)
          show(due[0].id, true)
        }
        return current
      })
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [mode, playing, openId, length, show])

  useEffect(() => {
    setFurthest((value) => Math.max(value, time))
    if (length && time >= length) {
      setEnded(true)
      if (mode === 'practice') setPlaying(false)
    }
  }, [time, length, mode])

  const togglePlay = () => {
    if (mode === 'youtube') {
      if (playing) pause()
      else resume(PLAYER_ID)
      return
    }
    setPlaying((value) => !value)
  }

  /** Close the card; when the player paused for it, playback resumes within 300 ms (spec 7A.11). */
  const close = (saved?: { pointId: number; text: string; message: string }) => {
    if (saved) {
      setAnswered((value) => ({ ...value, [saved.pointId]: saved.text }))
      setNotice(saved.message)
    }
    const following = queue.current.shift()
    if (following && fromTrigger) {
      setOpenId(following)
      return
    }
    const wasTriggered = fromTrigger
    setOpenId(null)
    setFromTrigger(false)
    if (wasTriggered) {
      if (mode === 'youtube') window.setTimeout(() => resume(PLAYER_ID), 120)
      else setPlaying(true)
    }
    if (saved) router.refresh()
  }

  const nextPoint = views.find((point) => point.state === 'open' && !point.answered) || views.find((point) => !point.answered) || null
  const open = views.find((point) => point.id === openId) || null
  const total = length || Math.max(60, ...views.map((point) => point.second + 30))

  return (
    <div data-testid="player" data-mode={mode} data-popup-layout={overPlayer ? 'over' : 'strict'}>
      <div className="app-head" style={{ marginBottom: 6 }}>
        <Link className="back" href={backHref} data-testid="back">‹ {courseTitle}</Link>
      </div>
      <div ref={card} className={`player-card${mode === 'youtube' ? ' yt-on' : ''}`} data-testid="player-card">
        {poster && mode !== 'youtube' ? <div className="poster" style={{ backgroundImage: `url(${poster})` }} /> : null}
        {youtubeId ? <div className="yt" style={{ visibility: mode === 'youtube' ? 'visible' : 'hidden' }} ref={holder} /> : null}
        {open && mode === 'youtube' ? (
          <span className="part-chip paused" data-testid="paused-note">❚❚ Paused at question {open.number}</span>
        ) : (
          <span className="part-chip" data-testid="part-label">{partLabel}</span>
        )}
        <span className="time-read" data-testid="player-time">{clock(time)}</span>
        {open && mode !== 'youtube' ? (
          <p className="paused-note" data-testid="paused-note">❚❚ Paused at question {open.number}</p>
        ) : mode !== 'youtube' ? (
          <button type="button" className="big-play" aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlay} data-testid="player-play">
            {playing ? <PauseIcon size={30} /> : <PlayIcon size={30} />}
          </button>
        ) : null}
        <div className="timeline" data-testid="timeline">
          <div className="track" />
          <div className="fill" style={{ width: `${Math.min(100, (time / total) * 100)}%` }} />
          {views.map((point) => (
            <button
              key={point.id}
              type="button"
              className={`dot${point.answered ? ' done' : point.state !== 'open' ? ' locked' : ''}`}
              style={{ left: `${Math.min(98, Math.max(2, (point.second / total) * 100))}%` }}
              aria-label={`Question ${point.number} at ${clock(point.second)}`}
              data-testid="timeline-dot"
              data-state={point.state}
              data-second={point.second}
              onClick={() => {
                pause()
                show(point.id, false)
              }}
            />
          ))}
        </div>
      </div>
      {views.length ? (
        <div className="q-strip" data-testid="question-strip" aria-label="Questions in this film">
          {views.map((point) => (
            <span key={point.id} className={point.answered ? 'done' : 'open'} data-testid="strip-dot" data-answered={point.answered ? 'yes' : 'no'} title={point.prompt}>
              {point.answered ? '✓' : point.number}
            </span>
          ))}
        </div>
      ) : null}
      {mode === 'practice' ? (
        <p className="muted" style={{ fontSize: 13, margin: '8px 2px 0' }} data-testid="practice-note">
          {youtubeId ? 'The film could not load here, so the timeline runs on its own.' : 'This talk has no film link yet, so the timeline runs on its own.'} Press play and it will stop at each question.
        </p>
      ) : null}
      {notice ? <p className="flash notice" data-testid="notice" role="status">{notice}</p> : null}
      <button type="button" className="answer-btn" disabled={!nextPoint} onClick={() => nextPoint && show(nextPoint.id, false)} data-testid="answer-point">
        {nextPoint ? `Answer question ${nextPoint.number} →` : views.length ? 'All questions answered' : 'No questions on this part yet'}
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
      {open ? (
        <Sheet
          key={open.id}
          point={open}
          lessonId={lessonId}
          atSecond={time}
          viewingId={viewing.current}
          triggered={fromTrigger}
          top={sheetTop}
          swarm={swarm[open.id] || []}
          swarmOn={swarmOn}
          now={now}
          onClose={close}
        />
      ) : null}
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

type Saved = { pointId: number; text: string; message: string }

function Sheet({
  point,
  lessonId,
  atSecond,
  viewingId,
  triggered,
  top,
  swarm,
  swarmOn,
  now,
  onClose,
}: {
  point: PointView
  lessonId: number
  atSecond: number
  viewingId: string
  triggered: boolean
  top: number | null
  swarm: SwarmItem[]
  swarmOn: boolean
  now: number
  onClose: (saved?: Saved) => void
}) {
  const [keepPrivate, setKeepPrivate] = useState(true)
  const [error, setError] = useState('')
  const [leaving, setLeaving] = useState(false)
  const [left, setLeft] = useState(point.timeLimitSec && point.state === 'open' && !point.answered ? point.timeLimitSec : null)
  const [recording, setRecording] = useState(false)
  const [audioName, setAudioName] = useState('')
  const [imageName, setImageName] = useState('')
  const [sending, setSending] = useState(false)
  const recorder = useRef<MediaRecorder | null>(null)
  const audioInput = useRef<HTMLInputElement>(null)

  const leave = (saved?: Saved) => {
    setLeaving(true)
    window.setTimeout(() => onClose(saved), 180)
  }

  const later = () => {
    void fetch('/api/answers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ later: true, lessonId }) }).catch(() => undefined)
    leave()
  }

  useEffect(() => {
    if (left === null) return
    if (left <= 0) {
      later()
      return
    }
    const timer = window.setTimeout(() => setLeft((value) => (value === null ? null : value - 1)), 1000)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left])

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSending(true)
    setError('')
    const form = new FormData(event.currentTarget)
    form.set('answeredAt', new Date().toISOString())
    form.set('atSecond', String(Math.round(atSecond)))
    form.set('viewingId', viewingId)
    try {
      const response = await fetch('/api/answers', { method: 'POST', body: form })
      const result = (await response.json().catch(() => ({}))) as { error?: string; keepPrivate?: boolean; sharedWithLearners?: boolean }
      if (!response.ok) {
        setError(result.error || 'That did not save. Try once more.')
        setSending(false)
        return
      }
      const text = String(form.get('body') || form.get('choice') || 'Saved in your workbook.')
      leave({ pointId: point.id, text, message: result.keepPrivate ? 'Saved privately in your workbook.' : result.sharedWithLearners ? 'Saved in your workbook and shared with other learners.' : 'Saved in your workbook.' })
    } catch {
      setError('You seem to be offline. Your answer is still here; try again in a moment.')
      setSending(false)
    }
  }

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
      <div className="sheet-scrim" style={top !== null ? { top } : undefined} onClick={() => leave()} data-testid="popup-scrim" />
      <section
        className={`sheet${top !== null ? ' pinned' : ''}${leaving ? ' leaving' : ''}`}
        style={top !== null ? { top, maxHeight: 'none' } : undefined}
        role="dialog"
        aria-label={point.prompt}
        data-testid="popup"
        data-state={point.state}
        data-point={point.id}
        data-triggered={triggered ? 'yes' : 'no'}
      >
        <div className="handle" />
        <button type="button" className="sheet-close" aria-label="Close" onClick={() => leave()} data-testid="popup-close">×</button>
        {left !== null ? <p className="time-left" data-testid="time-left">{left}s left to answer</p> : null}
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
          <form onSubmit={submit} data-testid="answer-form">
            <input type="hidden" name="pointId" value={point.id} />
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
            {swarmOn ? (
              <label className="toggle"><input type="checkbox" name="shareWithLearners" disabled={keepPrivate} data-testid="answer-share-learners" /> Let other learners on this video read it</label>
            ) : null}
            <button className="share-btn" type="submit" disabled={sending} data-testid="answer-submit">
              {sending ? 'Saving…' : `${keepPrivate ? 'Save' : 'Share'} my ${SUBMIT[point.kind]}`}
            </button>
            {error ? <p className="flash error" data-testid="answer-error" role="alert">{error}</p> : null}
            {!point.answered ? <button type="button" className="link-btn" onClick={later} data-testid="answer-later" style={{ width: '100%' }}>Answer later</button> : null}
          </form>
        ) : null}
        {swarmOn ? (
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
        ) : null}
      </section>
    </>
  )
}
