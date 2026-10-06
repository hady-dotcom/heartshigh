'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { newViewingId, POLL_MS, PopupWatcher, type PopupPoint } from '@/lib/popups'
import { comingAnswerLabel, comingQuestionLabel, questionMomentReached, questionRowRevealed, revealedStorageKey } from '@/lib/question-list'
import { TopicHelp } from '@/components/app/page-help'
import { SpokenWords } from '@/components/app/spoken-words'
import type { FramingSentence } from '@/lib/framing/types'
import { placeDots } from '@/lib/timeline-dots'
import { coursePlayVisible } from '@/lib/course-controls'
import { nextPlaybackRate } from '@/lib/playback-rate'
import { createPlayer, destroyPlayer, getPlayer, hasSound, pauseKeepingSound, playWithSoundFallback, resume, soundOn, STATE, UNPLAYABLE } from '@/lib/yt'
import { boardClickAllowed, boardShouldClose, boardShouldOpen, pointerTravel } from '@/lib/board-gestures'
import { YT_CHROME_HOLD_MS, coverFallbackAction, coverHoldShouldRestart, landscapeThumb, playerReadout, ytDebugOn } from '@/lib/yt-cover'
import { SwarmList } from '@/components/app/swarm-list'
import { initialsOf } from '@/lib/swarm-sort'
import { HeartIcon, ImageIcon, LockIcon, MicIcon } from '../icons'
import { track } from '@/lib/experiment-track'
import { ReportButton } from '@/components/app/report-sheet'

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
  dueDays?: number | null
  evidence?: 'none' | 'note' | 'photo' | null
  showImam?: boolean
  family?: string | null
  gatherings?: { href: string; title: string; when: string }[]
}

export type SwarmItem = { name: string; body: string; image?: string | null; circle?: boolean; initials?: string; id?: number; kind?: 'answer' | 'circle-answer' }

function clock(total: number) {
  const value = Math.max(0, Math.floor(total))
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const seconds = value % 60
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`
}

const KIND_LABEL: Record<PointView['kind'], string> = { question: 'Question', task: 'Task', reflection: 'Reflection', multiple_choice: 'Multi-choice' }
const SUBMIT: Record<PointView['kind'], string> = { question: 'answer', task: 'task', reflection: 'reflection', multiple_choice: 'choice' }

const PLAYER_ID = 'lesson'
/** The longest jump between two time readings that still counts as playing; anything longer is a seek. */
const MAX_STEP = 2

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
  circleLabel = '',
  serverNow,
  next,
  garden,
  overPlayer = true,
  film = null,
  upNext = null,
  courseHref = backHref,
  deferred = [],
  initialOpenId = null,
  sentences = [],
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
  /** The light label under HEARTS circle answers (master flag circleLabel). */
  circleLabel?: string
  serverNow: string
  next: string
  garden: { done: number; total: number; links: { label: string; href: string }[]; gardenHref: string; nextPart?: { label: string; href: string } | null }
  /** Master flag popupOverPlayer. Off is the strict layout: the paused player stays fully in view. */
  overPlayer?: boolean
  film?: { provider: 'vimeo' | 'file'; vimeoId?: string | null; src?: string | null } | null
  upNext?: { href: string; label: string; minutes: number; last: boolean } | null
  courseHref: string
  deferred?: { pointId: number; prompt: string }[]
  initialOpenId?: number | null
  sentences?: FramingSentence[]
}) {
  const router = useRouter()
  const card = useRef<HTMLDivElement>(null)
  const holder = useRef<HTMLDivElement>(null)
  const filmBox = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const vimeoTime = useRef(startAt)
  const watcher = useRef<PopupWatcher | null>(null)
  const viewing = useRef('')
  const queue = useRef<number[]>([])
  const vimeoId = film?.provider === 'vimeo' ? film.vimeoId || null : null
  const fileSrc = film?.provider === 'file' ? film.src || null : null
  const [mode, setMode] = useState<'loading' | 'youtube' | 'vimeo' | 'file' | 'practice'>(vimeoId ? 'vimeo' : fileSrc ? 'file' : youtubeId ? 'loading' : 'practice')
  const [time, setTime] = useState(startAt)
  const [watched, setWatched] = useState(0)
  const lastTime = useRef(startAt)
  const timeRef = useRef(startAt)
  timeRef.current = time
  const [length, setLength] = useState(duration)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const speedRef = useRef(1)
  const [ended, setEnded] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)
  const [fromTrigger, setFromTrigger] = useState(false)
  const [sheetTop, setSheetTop] = useState<number | null>(null)
  const [answered, setAnswered] = useState<Record<number, string>>({})
  const [notice, setNotice] = useState('')
  const [now, setNow] = useState(() => new Date(serverNow).getTime())
  const [lit, setLit] = useState(false)
  const [trackWidth, setTrackWidth] = useState(340)
  const timelineRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const [boot, setBoot] = useState(0)
  const [endCard, setEndCard] = useState(false)
  const [boardOpen, setBoardOpen] = useState(false)
  const [coverHeld, setCoverHeld] = useState(true)
  const [ytState, setYtState] = useState(-1)
  const [debugOn, setDebugOn] = useState(false)
  const playStartedAt = useRef(0)
  const holdState = useRef(-9)
  const boardOpenedAt = useRef(0)
  const boardDrag = useRef<{ x: number; y: number } | null>(null)
  const [count, setCount] = useState(5)
  const [held, setHeld] = useState<number[]>(deferred.map((row) => row.pointId))
  const heldRef = useRef(held)
  heldRef.current = held
  const deferredPrompts = useRef(Object.fromEntries(deferred.map((row) => [row.pointId, row.prompt])))
  const [revealed, setRevealed] = useState<number[]>(() => [
    ...new Set([
      ...points.filter((point) => point.answered).map((point) => point.id),
      ...deferred.map((row) => row.pointId),
    ]),
  ])

  const reveal = useCallback((id: number) => {
    setRevealed((value) => {
      if (value.includes(id)) return value
      const next = [...value, id]
      try {
        sessionStorage.setItem(revealedStorageKey(lessonId), JSON.stringify(next))
      } catch {
        // Private mode.
      }
      return next
    })
  }, [lessonId])

  const views = points.map((point) => {
    const mine = answered[point.id] !== undefined ? { ...point, answered: true, myAnswer: answered[point.id] } : point
    const rewrite = deferredPrompts.current[point.id]
    return rewrite ? { ...mine, prompt: rewrite } : mine
  })
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
    track('full_talk_start', { lesson: lessonId })
  }, [lessonId])

  useEffect(() => {
    const timer = window.setInterval(() => setNow((value) => value + 1000), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    setDebugOn(ytDebugOn(window.location.search))
    try {
      const stored = JSON.parse(sessionStorage.getItem(revealedStorageKey(lessonId)) || '[]') as number[]
      if (Array.isArray(stored)) setRevealed((value) => [...new Set([...value, ...stored.filter((id) => Number.isFinite(id))])])
    } catch {
      // Private mode.
    }
  }, [lessonId])

  useEffect(() => {
    if (!youtubeId || !holder.current) return
    let cancelled = false
    destroyPlayer(PLAYER_ID)
    setFailed(false)
    setMode('loading')
    setYtState(-1)
    setCoverHeld(true)
    holdState.current = -9
    playStartedAt.current = 0
    const failFirst = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('heartsFailFirst') === '1'
    const fallback = window.setTimeout(() => {
      if (cancelled) return
      if (failFirst) setFailed(true)
      else setMode((value) => (value === 'loading' ? 'practice' : value))
    }, failFirst ? 8000 : 30_000)
    createPlayer({
      id: PLAYER_ID,
      host: holder.current,
      videoId: youtubeId,
      start: startAt,
      kind: 'full',
      onReady: (player) => {
        if (cancelled) return
        window.clearTimeout(fallback)
        setFailed(false)
        setMode('youtube')
        const total = player.getDuration() || 0
        if (total > 0) setLength(total)
        const activation = typeof navigator !== 'undefined' && Boolean(navigator.userActivation?.isActive || navigator.userActivation?.hasBeenActive)
        if (activation) soundOn(PLAYER_ID)
        playWithSoundFallback(player, hasSound() || activation)
      },
      onState: (state) => {
        setYtState(state)
        setPlaying(state === STATE.PLAYING)
        if (state === STATE.PLAYING) {
          setLit(true)
          getPlayer(PLAYER_ID)?.setPlaybackRate?.(speedRef.current)
        }
        if (state === STATE.ENDED) {
          setEnded(true)
          setLit(false)
          setPlaying(false)
        }
      },
      onError: (code) => {
        if (cancelled) return
        window.clearTimeout(fallback)
        if (failFirst) setFailed(true)
        else if (UNPLAYABLE.has(code)) setMode('practice')
      },
    }).catch(() => {
      if (cancelled) return
      if (failFirst) setFailed(true)
      else setMode('practice')
    })
    return () => {
      cancelled = true
      window.clearTimeout(fallback)
      destroyPlayer(PLAYER_ID)
    }
  }, [youtubeId, startAt, boot])

  useEffect(() => {
    if (!vimeoId) return
    const onMessage = (event: MessageEvent) => {
      if (!String(event.origin).includes('vimeo.com')) return
      let data = event.data as { event?: string; method?: string; value?: number; data?: { seconds?: number } }
      if (typeof event.data === 'string') {
        try { data = JSON.parse(event.data) } catch { return }
      }
      const seconds = data?.data?.seconds ?? (typeof data?.value === 'number' ? data.value : null)
      if (typeof seconds === 'number') vimeoTime.current = seconds
      if (data?.event === 'play') setPlaying(true)
      if (data?.event === 'pause' || data?.event === 'finish') setPlaying(false)
      if (data?.event === 'finish') setEnded(true)
      if (data?.event === 'ready') {
        filmBox.current?.querySelector('iframe')?.contentWindow?.postMessage(JSON.stringify({ method: 'addEventListener', value: 'playProgress' }), '*')
        filmBox.current?.querySelector('iframe')?.contentWindow?.postMessage(JSON.stringify({ method: 'addEventListener', value: 'play' }), '*')
        filmBox.current?.querySelector('iframe')?.contentWindow?.postMessage(JSON.stringify({ method: 'addEventListener', value: 'pause' }), '*')
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [vimeoId])

  // The sheet never covers the film: default keeps the paused video in view above it, strict keeps the whole player clear.
  const placeSheet = useCallback(() => {
    // Lock scrolling before measuring: dropping the scrollbar can reflow the player by a few pixels.
    document.documentElement.style.overflow = 'hidden'
    card.current?.scrollIntoView({ block: 'start' })
    const rect = card.current?.getBoundingClientRect()
    const filmed = mode === 'youtube' || mode === 'vimeo' || mode === 'file'
    const film = filmed ? (mode === 'youtube' ? holder.current : filmBox.current)?.getBoundingClientRect() : null
    setSheetTop(rect ? Math.max(8, overPlayer && film ? film.bottom : rect.bottom) : null)
  }, [overPlayer, mode])

  const show = useCallback(
    (id: number, triggered: boolean) => {
      const point = viewsRef.current.find((row) => row.id === id)
      if (!point) return
      if (!triggered && point.state !== 'open' && !questionMomentReached({ second: point.second, time: timeRef.current, answered: point.answered })) return
      reveal(id)
      const at = point.second
      lastTime.current = at
      setTime(at)
      getPlayer(PLAYER_ID)?.seekTo(at, true)
      if (videoRef.current) videoRef.current.currentTime = at
      vimeoTime.current = at
      filmBox.current?.querySelector('iframe')?.contentWindow?.postMessage(JSON.stringify({ method: 'setCurrentTime', value: at }), '*')
      placeSheet()
      setFromTrigger(triggered)
      setOpenId(id)
    },
    [placeSheet, reveal],
  )

  // The player changes shape once YouTube is ready, so a sheet opened before that moves with it.
  useEffect(() => {
    if (openId === null) return
    const frame = window.requestAnimationFrame(placeSheet)
    window.addEventListener('resize', placeSheet)
    const watcher = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => placeSheet())
    if (card.current) watcher?.observe(card.current)
    watcher?.observe(document.body)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', placeSheet)
      watcher?.disconnect()
    }
  }, [openId, placeSheet])

  useEffect(() => {
    if (openId === null) return
    return () => {
      document.documentElement.style.overflow = ''
    }
  }, [openId])

  const pause = () => {
    const player = getPlayer(PLAYER_ID)
    if (player) pauseKeepingSound(player, hasSound() || !player.isMuted())
    videoRef.current?.pause()
    filmBox.current?.querySelector('iframe')?.contentWindow?.postMessage(JSON.stringify({ method: 'pause' }), '*')
    setPlaying(false)
  }

  // Keep the film truly paused while a question is open: YouTube can resume itself after a seek or buffer.
  useEffect(() => {
    if (openId === null) return
    pause()
    const timer = window.setInterval(() => {
      const player = getPlayer(PLAYER_ID)
      const state = player?.getPlayerState()
      if (state === STATE.PLAYING || state === STATE.BUFFERING) player?.pauseVideo()
      if (videoRef.current && !videoRef.current.paused) videoRef.current.pause()
      filmBox.current?.querySelector('iframe')?.contentWindow?.postMessage(JSON.stringify({ method: 'pause' }), '*')
      const at = player?.getCurrentTime()
      if (typeof at === 'number') setTime(at)
      setPlaying(false)
    }, 250)
    return () => window.clearInterval(timer)
  }, [openId])

  useEffect(() => {
    if (initialOpenId && viewsRef.current.some((point) => point.id === initialOpenId)) show(initialOpenId, true)
  }, [initialOpenId, show])

  const revealEnd = useCallback(() => {
    const waiting = heldRef.current.find((id) => viewsRef.current.some((point) => point.id === id && !point.answered))
    if (waiting) {
      pause()
      show(waiting, false)
      setHeld((value) => value.filter((id) => id !== waiting))
      void fetch('/api/answers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ thinkRead: true, pointId: waiting, lessonId }) }).catch(() => undefined)
      return
    }
    setEndCard(true)
    setCount(5)
  }, [lessonId, show])

  useEffect(() => {
    if (!ended || openId !== null || endCard) return
    const timer = window.setTimeout(revealEnd, 400)
    return () => window.clearTimeout(timer)
  }, [ended, openId, endCard, revealEnd])

  useEffect(() => {
    if (!endCard || upNext?.last) return
    if (count <= 0) {
      if (upNext?.href) router.push(upNext.href)
      return
    }
    const timer = window.setTimeout(() => setCount((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [endCard, count, upNext, router])

  useEffect(() => {
    if (!playing || openId !== null) return
    const timer = window.setInterval(() => {
      if (mode === 'vimeo') filmBox.current?.querySelector('iframe')?.contentWindow?.postMessage(JSON.stringify({ method: 'getCurrentTime' }), '*')
      const at = mode === 'youtube' ? getPlayer(PLAYER_ID)?.getCurrentTime() || 0 : mode === 'file' ? videoRef.current?.currentTime ?? null : mode === 'vimeo' ? vimeoTime.current : null
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

  // Only seconds that played count towards the sitting: a seek, or opening where the appetiser ended, adds nothing.
  useEffect(() => {
    const step = time - lastTime.current
    lastTime.current = time
    if (step > 0 && step <= MAX_STEP) setWatched((value) => value + step)
    if (length && time >= length) {
      setEnded(true)
      if (mode === 'practice') setPlaying(false)
    }
  }, [time, length, mode])

  const postedWatch = useRef(0)
  useEffect(() => {
    if (watched < 8 || watched - postedWatch.current < 15) return
    postedWatch.current = watched
    const body = new URLSearchParams({ action: 'watch', lesson: String(lessonId), seconds: String(Math.floor(watched)) })
    void fetch('/api/hearts', { method: 'POST', headers: { accept: 'application/json' }, body }).catch(() => undefined)
  }, [lessonId, watched])

  useEffect(() => {
    for (const point of points) {
      if (point.answered || answered[point.id] !== undefined || time + 0.01 >= point.second) reveal(point.id)
    }
  }, [answered, points, reveal, time])

  useEffect(() => {
    const el = timelineRef.current
    if (!el) return
    const read = () => setTrackWidth(el.clientWidth || 340)
    read()
    const observer = new ResizeObserver(read)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const applySpeed = (rate: number) => {
    getPlayer(PLAYER_ID)?.setPlaybackRate?.(rate)
    if (videoRef.current) videoRef.current.playbackRate = rate
    filmBox.current?.querySelector('iframe')?.contentWindow?.postMessage(JSON.stringify({ method: 'setPlaybackRate', value: rate }), '*')
  }

  const cycleSpeed = () => {
    const next = nextPlaybackRate(speedRef.current)
    speedRef.current = next
    setSpeed(next)
    applySpeed(next)
  }
  const openDrawer = () => {
    boardOpenedAt.current = performance.now()
    setBoardOpen(true)
  }
  const closeDrawer = () => setBoardOpen(false)
  const boardAction = (event: { stopPropagation(): void; preventDefault(): void; clientX: number; clientY: number }, fn: () => void) => {
    event.stopPropagation()
    event.preventDefault()
    const start = boardDrag.current
    const travel = start ? pointerTravel({ x: start.x, y: start.y }, { x: event.clientX, y: event.clientY }) : 0
    if (!boardClickAllowed({ openedAt: boardOpenedAt.current, now: performance.now(), travel })) return
    fn()
  }
  const openBoard = (event: ReactPointerEvent) => {
    event.stopPropagation()
    event.preventDefault()
    boardDrag.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const moveBoard = (event: ReactPointerEvent) => {
    const start = boardDrag.current
    if (!start) return
    event.stopPropagation()
    event.preventDefault()
  }
  const finishBoard = (event: ReactPointerEvent) => {
    const start = boardDrag.current
    boardDrag.current = null
    if (!start) return
    event.stopPropagation()
    event.preventDefault()
    const dy = event.clientY - start.y
    const travel = pointerTravel({ x: start.x, y: start.y }, { x: event.clientX, y: event.clientY })
    if ((event.target as HTMLElement).closest('[data-testid="feed-board"]') && (event.target as HTMLElement).closest('button, a, input, textarea, select, label')) return
    if (boardShouldOpen(dy)) openDrawer()
    else if (boardShouldClose(dy)) closeDrawer()
    else if (travel < 14) {
      if (boardOpen) closeDrawer()
      else openDrawer()
    }
  }

  const resumeNow = () => {
    soundOn(PLAYER_ID)
    getPlayer(PLAYER_ID)?.unMute()
    if (videoRef.current) videoRef.current.muted = false
    applySpeed(speedRef.current)
    if (mode === 'youtube') resume(PLAYER_ID)
    else if (mode === 'file') void videoRef.current?.play()
    else if (mode === 'vimeo') filmBox.current?.querySelector('iframe')?.contentWindow?.postMessage(JSON.stringify({ method: 'play' }), '*')
    else setPlaying(true)
  }

  const togglePlay = () => {
    if (playing) {
      pause()
      return
    }
    resumeNow()
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
    if (wasTriggered) resumeNow()
    if (saved) {
      const left = viewsRef.current.filter((point) => point.id !== saved.pointId && !point.answered)
      if (!left.length) window.setTimeout(revealEnd, 400)
      router.refresh()
    }
  }

  const thinkAbout = (pointId: number) => {
    setHeld((value) => (value.includes(pointId) ? value : [...value, pointId]))
    void fetch('/api/answers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ think: true, pointId, lessonId }) }).catch(() => undefined)
    close()
  }

  const nextPoint = views.find((point) => point.state === 'open' && !point.answered) || null
  const waitingOnFilm = views.some((point) => !point.answered)
  const open = views.find((point) => point.id === openId) || null
  const total = length || Math.max(60, ...views.map((point) => point.second + 30))
  const filmed = mode === 'youtube' || mode === 'vimeo' || mode === 'file'
  const coverUrl = landscapeThumb(youtubeId) || poster
  const places = new Map(placeDots(views.map((row) => ({ id: row.id, second: row.second })), total, trackWidth).map((row) => [row.id, row]))

  const livePlayer = getPlayer(PLAYER_ID)
  const liveState = livePlayer?.getPlayerState() ?? ytState
  const liveTime = livePlayer?.getCurrentTime() ?? time
  const showCover = coverHeld || liveState !== STATE.PLAYING || ended || mode === 'loading'
  useEffect(() => {
    const state = liveState
    if (state === STATE.PLAYING && !ended) {
      if (coverHoldShouldRestart(state, holdState.current, liveTime > startAt + 0.12)) {
        playStartedAt.current = performance.now()
        setCoverHeld(true)
      }
      holdState.current = state
      const left = YT_CHROME_HOLD_MS - (performance.now() - playStartedAt.current)
      const timer = window.setTimeout(() => setCoverHeld(false), Math.max(0, left))
      return () => window.clearTimeout(timer)
    }
    holdState.current = state
    playStartedAt.current = 0
    setCoverHeld(true)
  }, [ended, liveState, liveTime, startAt])
  useEffect(() => {
    if (!youtubeId || ended) return
    const begun = performance.now()
    const timer = window.setInterval(() => {
      const player = getPlayer(PLAYER_ID)
      if (!player) return
      const polledState = player.getPlayerState()
      const polledTime = player.getCurrentTime()
      setYtState(polledState)
      if (polledState === STATE.PLAYING) {
        setPlaying(true)
        setLit(true)
        setMode('youtube')
        setTime(polledTime)
      } else if (polledState === STATE.PAUSED || polledState === STATE.ENDED) {
        setPlaying(false)
        if (polledState === STATE.ENDED) setEnded(true)
        setTime(polledTime)
      }
      const action = coverFallbackAction({
        waitedMs: performance.now() - begun,
        eventPlaying: polledState === STATE.PLAYING,
        polledState,
        polledTime,
        start: startAt,
      })
      if (action === 'treat-playing' && polledState !== STATE.PLAYING) {
        setPlaying(true)
        setLit(true)
        setMode('youtube')
        if (!playStartedAt.current) playStartedAt.current = performance.now()
      }
      if (action === 'retry') playWithSoundFallback(player, hasSound())
    }, 400)
    return () => window.clearInterval(timer)
  }, [ended, startAt, youtubeId])
  return (
    <div data-testid="player" data-mode={mode} data-playing={playing ? 'yes' : 'no'} data-framing="F" data-board={boardOpen ? 'open' : 'closed'} data-cover={showCover ? 'yes' : 'no'} data-popup-layout={overPlayer ? 'over' : 'strict'}>
      {debugOn ? (
        <pre className="yt-debug" data-testid="yt-debug">
          {playerReadout({ state: liveState, time, currentTime: liveTime, cover: showCover })}
        </pre>
      ) : null}
      <div className="course-film">
        <div className="j-hairline-row">
          <div className={`j-hairline${mode === 'loading' ? ' shimmer' : ''}`} data-testid="hairline"><i style={{ width: `${Math.min(100, (time / total) * 100)}%` }} /></div>
          <div className="clip-row">
            <div className="clip-row-top">
              <Link className="chip white" href={backHref} data-testid="back">‹ Back</Link>
            </div>
          </div>
        </div>
        <div ref={card} className={`player-card is-f course-film-band${filmed ? ' yt-on' : ''}${playing ? ' is-live' : ''}${mode === 'loading' ? ' is-loading' : ''}`} data-testid="player-card">
          <div className={`poster${mode === 'loading' ? ' skeleton' : ''}${showCover ? '' : ' is-clear'}`} style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined} data-testid={mode === 'loading' ? 'player-skeleton' : 'player-poster'} />
          {mode === 'loading' && !failed ? <div className="player-veil" data-testid="player-veil" aria-hidden><span className="gold-spin" /></div> : null}
          {failed ? (
            <div className="player-retry" data-testid="player-retry">
              <p>This film did not start.</p>
              <button type="button" className="pill gold" onClick={() => { setFailed(false); setMode('loading'); setBoot((value) => value + 1) }}>
                Try again
              </button>
            </div>
          ) : null}
          {youtubeId ? <div className="yt j-film-band yt-crop" style={{ visibility: mode === 'youtube' ? 'visible' : 'hidden' }} ref={holder} /> : null}
          {vimeoId ? (
            <div className="yt j-film-band" ref={filmBox} style={{ visibility: mode === 'vimeo' ? 'visible' : 'hidden' }}>
              <iframe title={partLabel} src={`https://player.vimeo.com/video/${vimeoId}?api=1`} allow="autoplay; fullscreen; picture-in-picture" data-testid="vimeo-player" />
            </div>
          ) : null}
          {fileSrc ? (
            <div className="yt j-film-band" ref={filmBox} style={{ visibility: mode === 'file' ? 'visible' : 'hidden' }}>
              <video ref={videoRef} src={fileSrc} playsInline data-testid="file-player" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setEnded(true); setLit(false) }} />
            </div>
          ) : null}
          {open && overPlayer && (filmed || youtubeId) ? <div className="yt-scrim" data-testid="paused-scrim" aria-hidden /> : null}
          {open && !playing ? (
            <span className="paused-note on-film" data-testid="paused-note">❚❚ Paused at question {open.number}</span>
          ) : null}
          {!playing && filmed && lit ? <span className="j-paused-mark" data-testid="paused-mark" aria-hidden>❚❚</span> : null}
          {open && !filmed && !playing ? (
            <p className="paused-note" data-testid="paused-note">❚❚ Paused at question {open.number}</p>
          ) : null}
          {coursePlayVisible({ loading: mode === 'loading', questionOpen: open !== null }) ? (
            <button type="button" className="j-tap-catcher film-tap" aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlay} data-testid="player-play" />
          ) : null}
        </div>
        <SpokenWords sentences={sentences} time={time} title={courseTitle} titles={[courseTitle, partLabel]} from={0} to={length || duration} />
      </div>
      <button
        type="button"
        className="j-more-tab"
        data-testid="more-board"
        aria-expanded={boardOpen}
        aria-label="More"
        hidden={boardOpen}
        onPointerDown={openBoard}
        onPointerMove={moveBoard}
        onPointerUp={finishBoard}
        onPointerCancel={() => { boardDrag.current = null }}
        onClick={(event) => event.preventDefault()}
      >
        <i />
        More
      </button>
      {boardOpen ? (
        <div
          className="j-board-back"
          data-testid="board-back"
          onPointerDown={(event) => { event.stopPropagation(); event.preventDefault(); closeDrawer() }}
          onClick={(event) => { event.stopPropagation(); closeDrawer() }}
        />
      ) : null}
      {boardOpen ? (
        <div
          className="j-board course-board"
          data-testid="feed-board"
          onPointerDown={(event) => {
            event.stopPropagation()
            boardDrag.current = { x: event.clientX, y: event.clientY }
            if ((event.target as HTMLElement).closest('button, a, input, textarea, select, label')) return
            event.currentTarget.setPointerCapture?.(event.pointerId)
          }}
          onPointerMove={moveBoard}
          onPointerUp={finishBoard}
        >
          <span className="j-board-handle" data-testid="board-handle" />
          <span className="time-read" data-testid="player-time">{clock(time)} / {clock(total)}</span>
          <button type="button" className="lecture-speed" data-testid="lecture-speed" aria-label="Playback speed" onClick={(event) => boardAction(event, cycleSpeed)}>{speed}×</button>
        <div className="timeline" data-testid="timeline" ref={timelineRef}>
          <div className="track" />
          <div className="fill" style={{ width: `${Math.min(100, (time / total) * 100)}%` }} />
          {views.map((point) => {
            const place = places.get(point.id)
            const reached = questionMomentReached({ second: point.second, time, answered: point.answered })
            const locked = !point.answered && point.state !== 'open'
            return (
            <button
              key={point.id}
              type="button"
              className={`dot${point.answered ? ' done' : locked ? ' locked' : ''}`}
              style={{ left: `${place?.left ?? 2}%` }}
              aria-label={reached ? `Question ${point.number} at ${clock(point.second)}` : `Question ${point.number} at ${clock(point.second)}`}
              data-testid="timeline-dot"
              data-state={point.state}
              data-second={point.second}
              data-moment={reached ? 'reached' : 'waiting'}
              disabled={locked}
              onClick={() => {
                if (locked) return
                pause()
                show(point.id, true)
              }}
            >
              <i>{reached ? point.number : ''}</i>
            </button>
            )
          })}
        </div>
        </div>
      ) : null}
      <div className="course-body">
      <p className="part-chip off-film" data-testid="part-label">{partLabel}</p>
      {views.length ? (
        <ul className="q-list" data-testid="question-strip" aria-label="Questions in this film">
          {views.map((point) => {
            const seen = questionRowRevealed({ id: point.id, second: point.second, time, revealedIds: revealed, answered: point.answered })
            return (
            <li
              key={point.id}
              className={point.answered ? 'done' : seen ? 'open' : 'coming'}
              data-testid="strip-dot"
              data-answered={point.answered ? 'yes' : 'no'}
              data-revealed={seen ? 'yes' : 'no'}
            >
              {seen ? point.prompt : comingQuestionLabel(point.number, point.second)}
            </li>
            )
          })}
        </ul>
      ) : null}
      {mode === 'practice' ? (
        <p className="muted" style={{ fontSize: 13, margin: '8px 2px 0' }} data-testid="practice-note">
          {youtubeId ? 'The film could not load here, so the timeline runs on its own.' : 'This talk has no film link yet, so the timeline runs on its own.'} Press play and it will stop at each question.
        </p>
      ) : null}
      {notice ? <p className="flash notice" data-testid="notice" role="status">{notice}</p> : null}
      {upNext && !upNext.last ? (
        <Link className="up-next-row" href={upNext.href} data-testid="up-next">
          {upNext.label}{upNext.minutes ? ` (${upNext.minutes} min)` : ''}
        </Link>
      ) : (
        <p className="up-next-row last" data-testid="up-next">{upNext?.label || 'This is the last part of this course.'}</p>
      )}
      {endCard ? (
        <section className="up-next-card" data-testid="up-next-card">
          {upNext?.last ? (
            <>
              <h2>You&apos;ve finished this course.</h2>
              <Link className="pill gold block" href={courseHref} data-testid="choose-next">Choose what&apos;s next</Link>
            </>
          ) : (
            <>
              <p className="eyebrow">Up next</p>
              <h2>{upNext?.label || 'The next part'}</h2>
              <p className="muted" data-testid="up-next-count">Starting in {count}s.</p>
              <div className="up-next-actions">
                <Link className="pill gold" href={upNext?.href || courseHref} data-testid="watch-now">Watch now</Link>
                <Link className="pill outline" href={courseHref} data-testid="back-to-course">Back to the course</Link>
              </div>
            </>
          )}
        </section>
      ) : null}
      <div className="answer-row" data-testid="answer-row">
        <button type="button" className="answer-btn" disabled={!nextPoint} onClick={() => nextPoint && show(nextPoint.id, true)} data-testid="answer-point">
          {nextPoint ? `Answer question ${nextPoint.number} →` : waitingOnFilm ? comingAnswerLabel() : views.length ? 'All questions answered' : 'No questions on this part yet'}
        </button>
        {waitingOnFilm && !nextPoint ? <TopicHelp topic="hide-until-moment" label="When do questions appear?" /> : null}
      </div>
      <section className="garden-card" data-testid="course-garden">
        <p className="eyebrow">Course garden</p>
        <div className="garden-grid">
          {/* TODO: swap this crop for the painterly tree stage PR #13 adds at public/garden/trees/<lane>/stage-N.webp after that branch merges. */}
          <span className="course-tree" role="img" aria-label={`${garden.done} of ${garden.total} fruits`} />
          <div>
            <h3>What&apos;s done</h3>
            <small data-testid="fruit-count">{garden.done} of {garden.total} fruits</small>
            <p className="muted fruit-explain" data-testid="fruit-explain">Talks you have watched and questions you have answered in this course.</p>
            <div className="bar"><i style={{ width: `${garden.total ? (garden.done / garden.total) * 100 : 0}%` }} /></div>
            {garden.nextPart ? <Link className="garden-link" href={garden.nextPart.href} data-testid="garden-next">↗ {garden.nextPart.label}</Link> : null}
            {garden.links.map((link) => <Link key={link.href} className="garden-link" href={link.href}>↗ {link.label}</Link>)}
            <Link className="pill teal small" href={garden.gardenHref} style={{ marginTop: 6 }}>Open garden</Link>
          </div>
        </div>
      </section>
      <form className="watched-form" action="/api/hearts" method="post">
        <input type="hidden" name="action" value="complete" />
        <input type="hidden" name="level" value="talk" />
        <input type="hidden" name="lesson" value={lessonId} />
        <input type="hidden" name="seconds" value={Math.floor(watched)} />
        {length ? <input type="hidden" name="media" value={Math.floor(length)} /> : null}
        {ended ? <input type="hidden" name="ended" value="yes" /> : null}
        <input type="hidden" name="next" value={next} />
        <button className="link-btn" type="submit" data-testid="mark-watched">I have watched this part</button>
      </form>
      </div>
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
          circleLabel={circleLabel}
          now={now}
          onResume={() => { if (fromTrigger) resumeNow() }}
          onClose={close}
          onThink={() => thinkAbout(open.id)}
          next={next}
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
      <span><b>{days}</b>Days</span><span><b>{hours}</b>Hours</span><span><b>{minutes}</b>Min</span><span><b>{seconds}</b>S</span>
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
  circleLabel,
  now,
  onResume,
  onClose,
  onThink,
  next,
}: {
  point: PointView
  lessonId: number
  atSecond: number
  viewingId: string
  triggered: boolean
  top: number | null
  swarm: SwarmItem[]
  swarmOn: boolean
  circleLabel: string
  now: number
  onResume?: () => void
  onClose: (saved?: Saved) => void
  onThink: () => void
  next: string
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

  const leaveTimer = useRef<number | null>(null)
  // The timeline stays tappable above the sheet, so another card can open inside the slide-out; a late close
  // from this card must not shut that one.
  useEffect(() => () => {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
  }, [])

  const leave = (saved?: Saved) => {
    setLeaving(true)
    if (triggered) onResume?.()
    leaveTimer.current = window.setTimeout(() => onClose(saved), 180)
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
        data-sheet="answer"
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
            {point.kind === 'task' ? (
              <div data-testid="task-form" data-evidence={point.evidence || 'none'}>
                {point.dueDays ? <p data-testid="task-due">Due within {point.dueDays} days of opening this talk.</p> : null}
                {point.gatherings?.length ? (
                  <div data-testid="task-gatherings">
                    <p>This asks you to do it with others. These gatherings match.</p>
                    {point.gatherings.map((row) => <p key={row.href}><a href={row.href}>{row.title}</a> · {row.when}</p>)}
                  </div>
                ) : null}
                {point.evidence === 'photo' ? <p>Add a photo of what you did.</p> : (
                  <textarea name="body" rows={3} required={point.evidence === 'note'} placeholder={point.evidence === 'note' ? 'What did you do?' : 'A note is optional'} data-testid="answer-text" defaultValue={point.answered ? point.myAnswer : ''} />
                )}
              </div>
            ) : point.kind === 'multiple_choice' && point.options.length ? (
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
              <input type="file" name="image" accept="image/*" required={point.kind === 'task' && point.evidence === 'photo'} data-testid="answer-image" onChange={(event) => setImageName(event.target.files?.[0]?.name || '')} />
              {imageName ? <span className="attach-name">{imageName}</span> : null}
              {audioName ? <span className="attach-name">{audioName}</span> : null}
            </label>
            <label className="toggle"><input type="checkbox" name="keepPrivate" checked={keepPrivate} onChange={(event) => setKeepPrivate(event.target.checked)} data-testid="answer-private" /> Keep my answer private</label>
            {point.showImam ? <input type="hidden" name="shareWithTeacher" value="on" /> : null}
            {point.showImam ? <p data-testid="task-imam">Your imam and the portal admin can see this.</p> : <label className="toggle"><input type="checkbox" name="shareWithTeacher" data-testid="answer-share" /> Let my teacher read it</label>}
            {swarmOn ? (
              <label className="toggle"><input type="checkbox" name="shareWithLearners" disabled={keepPrivate} data-testid="answer-share-learners" /> Let other learners on this video read it</label>
            ) : null}
            <button className="share-btn" type="submit" disabled={sending} data-testid="answer-submit">
              {sending ? 'Saving…' : point.kind === 'task' ? 'I have done this' : `${keepPrivate ? 'Save' : 'Share'} my ${SUBMIT[point.kind]}`}
            </button>
            {error ? <p className="flash error" data-testid="answer-error" role="alert">{error}</p> : null}
            {!point.answered ? (
              <>
                <button type="button" className="pill teal block" onClick={onThink} data-testid="think-about-this" style={{ width: '100%', marginTop: 8 }}>
                  Think about this for this session
                </button>
                <button type="button" className="link-btn" onClick={later} data-testid="answer-later" style={{ width: '100%' }}>Answer later</button>
              </>
            ) : null}
          </form>
        ) : null}
        {swarmOn ? (
          <>
            <SwarmList
              items={swarm.map((item) => ({ ...item, initials: item.initials || initialsOf(item.name) }))}
              mine={point.myAnswer}
              circleLabel={circleLabel}
            />
            {swarm.some((item) => item.id && item.kind) ? (
              <div style={{ marginTop: 8 }}>
                {swarm.filter((item) => item.id && item.kind).map((item) => (
                  <ReportButton key={`${item.kind}-${item.id}`} targetType={item.kind!} targetId={item.id!} next={next} />
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </>
  )
}
