'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { FeedItem } from '@/server/learner'
import type { OpeningData } from '@/server/opening'
import { mixFeed } from '@/lib/feed-mix'
import { learnMoreTarget, settleOnLevel, swipeTarget, type Swipe } from '@/lib/feed-nav'
import { applySignal, applyTap, buildFeed, decay, freshState, markServed, planFrom, routeFeed, spineStart, upgradeSpine, type FeedSlot, type HeartState, type SceneOption, type Signal } from '@/lib/heart'
import { deviceKey, haptic, readHeart, readPending, sessionFlags, setSessionFlags, viewAsId, writeHeart, writePending } from '@/lib/device'
import { EASE, T, animate, finished, reducedMotion, wait } from '@/lib/motion'
import { appetiserJoin, appetiserStop, captionIndex, captionPage } from '@/lib/tiers'
import { learnMore } from '@/lib/nesting'
import { laneClips } from '@/lib/lanes'
import { isoWeek } from '@/lib/trends'
import { STATE, UNPLAYABLE, createPlayer, cue, destroyPlayer, getPlayer, halfVisible, hasSound, lowData, playOnly, preloadApi, setHidden, soundOn, type PlayerKind } from '@/lib/yt'
import { TabBar } from '../app/shell'
import { Avatar, FollowButton, Slide } from '../app/feed'
import { HeartIcon, SaveIcon, ShareIcon } from '../icons'
import { HelpScreen, Opener, SceneCard } from './scenes'
import { TeachingCard } from './teaching-card'
import { KeepPlaceSheet, type SheetReason } from './sheet'

type Phase = 'opener' | 'scene' | 'help' | 'handoff' | 'feed'
type Mode = 'hors' | 'appetiser'
type Spec = { key: string; videoId: string; start: number; end: number | null; kind: PlayerKind }
type Host = { spec: Spec | null; playerId: string | null; ready: boolean; state: number }
type Mains = { courseId: number; lessonId: number; title: string; poster: string | null }

export type JourneyProps = {
  base: string
  opening: OpeningData
  opener: { caption: string; subline: string; handOff: string; justShow: string }
  initial: 'opener' | 'help' | 'feed'
  signedIn: boolean
  learner: boolean
  viewAs: boolean
  keepPlace: boolean
  trendsOptIn: boolean
  startingDoor: number | null
  flags: { popupOverPlayer: boolean; chromeOverPlayer: boolean }
  mains: Record<string, Mains>
  unread: number
  /** /feed?lane=<key>: that lane's clips first. */
  lane?: string | null
  /** /feed?clip=<cut id>&play=appetiser: open on that clip, optionally straight into its appetiser. */
  clip?: number | null
  play?: 'appetiser' | null
  /** After placing, the quiz returns to the first-talk screen instead of the feed. */
  afterPlacing?: boolean
}

const TAB_DELAY = 200
const HOLD = 700

const appetiserEnd = (item: FeedItem) => appetiserStop(item.appetiser)

function clock(total: number) {
  const value = Math.max(0, Math.round(total))
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}


function useStoredSet(name: string) {
  const [values, setValues] = useState<string[]>([])
  useEffect(() => {
    try {
      setValues(JSON.parse(window.localStorage.getItem(deviceKey(name)) || '[]'))
    } catch {
      setValues([])
    }
  }, [name])
  const toggle = useCallback(
    (value: string) => {
      setValues((current) => {
        const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
        try {
          window.localStorage.setItem(deviceKey(name), JSON.stringify(next))
        } catch {
          // ignore
        }
        return next
      })
    },
    [name],
  )
  return [values, toggle] as const
}

export function Journey(props: JourneyProps) {
  const { base, opening, flags } = props
  const router = useRouter()
  const overlay = flags.chromeOverPlayer
  const ctx = useMemo(() => ({ ...opening.route, scales: opening.scales }), [opening])
  const scenes = opening.scenes
  const loginHref = `/login?next=${encodeURIComponent(`${base}/feed`)}`
  const backgroundsBase = opening.backgroundsBaseUrl || null

  const [phase, setPhase] = useState<Phase>(props.initial === 'feed' ? 'feed' : props.initial)
  const [sceneAt, setSceneAt] = useState(0)
  const [leaving, setLeaving] = useState<number | null>(null)
  const [reply, setReply] = useState<string | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [line, setLine] = useState<string | null>(null)
  const [signedIn, setSignedIn] = useState(props.signedIn)
  const heartRef = useRef<HeartState | null>(null)
  const [heart, setHeartState] = useState<HeartState | null>(null)
  const depth = useRef(0)
  const rewinding = useRef<string | null>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const leavingRef = useRef<HTMLDivElement>(null)
  const skyRefs = useRef<(HTMLDivElement | null)[]>([])

  const [items, setItems] = useState<FeedItem[]>([])
  const itemsRef = useRef<FeedItem[]>([])
  const [index, setIndex] = useState(0)
  const indexRef = useRef(0)
  const [mode, setMode] = useState<Mode>('hors')
  const modeRef = useRef<Mode>('hors')
  const [captionOpen, setCaptionOpen] = useState(false)
  const spanJoin = useRef<number | null>(null)
  const hosts = useRef<[Host, Host]>([
    { spec: null, playerId: null, ready: false, state: -1 },
    { spec: null, playerId: null, ready: false, state: -1 },
  ])
  const hostEls = useRef<(HTMLDivElement | null)[]>([null, null])
  const [visibleHost, setVisibleHostState] = useState<0 | 1>(0)
  const visibleRef = useRef<0 | 1>(0)
  const [readyTick, setReadyTick] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const revealedRef = useRef(false)
  const [tabs, setTabs] = useState(false)
  const firstPlaying = useRef(false)
  const [muted, setMuted] = useState(true)
  const typeRef = useRef<HTMLVideoElement>(null)
  const [buffering, setBuffering] = useState(false)
  const [slow, setSlow] = useState<'none' | 'breathe' | 'retry'>('none')
  const [offline, setOffline] = useState(false)
  const [errorNote, setErrorNote] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetReason | null>(null)
  const sheetRef = useRef<SheetReason | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [notForMe, setNotForMe] = useState(false)
  const [faves, toggleFave] = useStoredSet('hearts.faves.v1')
  const [saved, toggleSave] = useStoredSet('hearts.saved.v1')
  const [firstEver, setFirstEver] = useState(false)
  const [lineAt, setLineAt] = useState(0)
  const [spokenAt, setSpokenAt] = useState<number | null>(null)
  const watch = useRef<{ key: string; start: number; furthest: number; done90: boolean }>({ key: '', start: 0, furthest: 0, done90: false })
  const refilling = useRef(false)
  const clipRef = useRef<HTMLDivElement>(null)
  const slotRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ x: number; y: number; t: number; moved: boolean; timer: number | null } | null>(null)
  const captionDrag = useRef(false)
  const counter = useRef(0)
  const gathered = useRef(new Set<string>())

  const setHeart = useCallback((next: HeartState) => {
    heartRef.current = next
    setHeartState(next)
    writeHeart(next)
  }, [])

  const setVisibleHost = (value: 0 | 1) => {
    visibleRef.current = value
    setVisibleHostState(value)
    setHidden(hosts.current[value].playerId || '', false)
    setHidden(hosts.current[value === 0 ? 1 : 0].playerId || '', true)
  }

  // ---------- heart state on this device ----------
  useEffect(() => {
    const stored = readHeart()
    let state = stored && stored.portal === opening.portal ? stored : null
    const handedOff = Boolean((state as (HeartState & { handedOffAt?: number }) | null)?.handedOffAt)
    if (props.initial === 'opener' && state && !handedOff && state.scenesVersion !== opening.scenesVersion) state = null
    const unfinished = props.initial === 'opener' && state && !handedOff && state.taps.length ? state : null
    if (!state) {
      state = freshState(opening.portal, opening.scenesVersion)
      state.spinePointer = spineStart(props.startingDoor)
    }
    state = decay(upgradeSpine(state))
    heartRef.current = state
    setHeartState(state)
    if (props.initial !== 'opener' || stored) writeHeart(state)
    setSessionFlags({ ...sessionFlags() })
    const startAt = window.location.pathname.match(/\/start\/(\d+)$/)
    if (startAt) {
      // A reload mid-opening carries on with every tap kept, never past the first unanswered scene.
      const answered = new Set(unfinished?.taps.map((tap) => tap.scene) || [])
      const firstOpen = scenes.findIndex((scene) => !answered.has(scene.key))
      const next = firstOpen < 0 ? -1 : Math.min(firstOpen, Math.max(0, Number(startAt[1]) - 1))
      if (unfinished && next >= 0) {
        window.history.replaceState({ ...window.history.state, hearts: { scene: next } }, '', `${base}/start/${next + 1}`)
        pendingEnter.current = 'fade'
        setSceneAt(next)
        setPhase('scene')
      } else window.history.replaceState(window.history.state, '', `${base}/start`)
    }
    if (!viewAsId() && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    setOffline(!navigator.onLine)
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep my place across devices (P3): the server copy follows the device, never the other way round.
  useEffect(() => {
    if (!signedIn || !props.keepPlace || props.viewAs || !heart) return
    const timer = window.setTimeout(() => {
      void fetch('/api/hearts/state', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ state: heart }) }).catch(() => undefined)
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [heart, signedIn, props.keepPlace, props.viewAs])

  // First sign-in on a device that holds an unsynced opening (spec 2.10), and answers held before sign-up.
  useEffect(() => {
    if (!signedIn || !props.learner || props.viewAs || !heart) return
    const marked = heart as HeartState & { synced?: boolean; handedOffAt?: number }
    if (marked.handedOffAt && !marked.synced && heart.taps.length) {
      setHeart({ ...heart, synced: true } as HeartState)
      void fetch(`/api/workbook/opening?portal=${opening.portal}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scenesVersion: heart.scenesVersion, taps: heart.taps.map((tap) => ({ sceneKey: tap.scene, optionKey: tap.option, answeredAt: tap.at })) }),
      }).catch(() => undefined)
    }
    const pending = readPending()
    if (pending.length) {
      writePending([])
      void fetch('/api/answers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pending }) }).catch(() => writePending(pending))
    }
  }, [signedIn, props.learner, props.viewAs, heart, opening.portal, setHeart])

  // Weekly trend contribution (P6), only when the learner opted in.
  useEffect(() => {
    if (!signedIn || !props.trendsOptIn || props.viewAs || !heart || !heart.taps.length) return
    const week = isoWeek(new Date())
    const key = deviceKey('hearts.trends.v1')
    let stored: { week: string; sent?: boolean } | null = null
    try {
      stored = JSON.parse(window.localStorage.getItem(key) || 'null')
    } catch {
      stored = null
    }
    if (stored?.week === week && stored.sent) return
    // The server keeps one row per account per week whatever is sent; this only saves a repeat request.
    const top = routeFeed(heart, ctx)
    void fetch('/api/hearts/contribute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        doorKey: heart.taps.find((tap) => tap.scene === 'doors' && tap.option !== 'pass')?.option,
        scenePasses: heart.taps.filter((tap) => tap.option === 'pass').map((tap) => tap.scene),
        laneTop2: [top.L1, top.L2].filter(Boolean),
      }),
    })
      .then(() => window.localStorage.setItem(key, JSON.stringify({ week, sent: true })))
      .catch(() => undefined)
  }, [signedIn, props.trendsOptIn, props.viewAs, heart, ctx, opening.portal])

  // ---------- sky: dusk to first light, the only progress cue ----------
  const skyStep = phase === 'opener' || phase === 'help' ? 0 : phase === 'scene' ? sceneAt + 1 : 7
  useEffect(() => {
    skyRefs.current.forEach((el, at) => {
      if (!el) return
      const target = at <= skyStep ? 1 : 0
      const current = Number(getComputedStyle(el).opacity)
      if (Math.abs(current - target) < 0.01) return
      if (reducedMotion()) {
        el.style.opacity = String(target)
        return
      }
      animate(el, [{ opacity: current }, { opacity: target }], 1200, EASE.standard, { id: 'sky' })
      el.style.opacity = String(target)
    })
  }, [skyStep])

  // ---------- history ----------
  const push = (path: string, state: Record<string, unknown> = {}) => {
    window.history.pushState({ ...window.history.state, hearts: state }, '', path)
  }

  // ---------- players ----------
  const specFor = useCallback((item: FeedItem | undefined, kind: Mode): Spec | null => {
    if (!item || !item.youtubeId) return null
    if (kind === 'hors' && (item.card === 'film' || item.card === 'text' || item.card === 'question')) return null
    if (kind === 'hors' && (item.style || item.card === 'scene' || item.typography?.src)) return null
    if (kind === 'appetiser') {
      const spans = item.appetiser.spans
      const multi = Boolean(spans && spans.length > 1)
      return { key: `${item.cutId}:appetiser`, videoId: item.youtubeId, start: spans?.length ? spans[0].start : item.appetiser.start, end: multi ? null : appetiserEnd(item), kind: 'full' }
    }
    return { key: `${item.cutId}:hors`, videoId: item.youtubeId, start: item.hors.start, end: item.hors.end, kind: 'hors' }
  }, [])

  const tryPlay = useCallback(() => {
    const host = hosts.current[visibleRef.current]
    const el = slotRef.current
    if (!host.ready || !host.playerId || !revealedRef.current || sheetRef.current) return
    if (el && !halfVisible(el)) return
    playOnly(host.playerId)
  }, [])

  const onPlayerState = useCallback((at: 0 | 1, state: number) => {
    const host = hosts.current[at]
    host.state = state
    if (at !== visibleRef.current) {
      if (state === STATE.PLAYING && host.playerId) getPlayer(host.playerId)?.pauseVideo()
      return
    }
    if (state === STATE.PLAYING) {
      setBuffering(false)
      setSlow('none')
      setErrorNote(null)
      const player = host.playerId ? getPlayer(host.playerId) : null
      setMuted(player ? player.isMuted() : true)
      if (!firstPlaying.current) {
        firstPlaying.current = true
        performance.mark('first-playing')
        window.setTimeout(() => setTabs(true), TAB_DELAY)
      }
    }
    if (state === STATE.BUFFERING) {
      window.setTimeout(() => {
        if (hosts.current[visibleRef.current].state === STATE.BUFFERING) setBuffering(true)
      }, 600)
    }
    if (state === STATE.ENDED) window.dispatchEvent(new CustomEvent('hearts:ended'))
  }, [])

  const prepare = useCallback(
    async (at: 0 | 1, spec: Spec) => {
      const host = hosts.current[at]
      const el = hostEls.current[at]
      if (!el) return
      if (host.spec?.key === spec.key && host.playerId) return
      const existing = host.playerId ? getPlayer(host.playerId) : null
      if (existing && host.spec?.kind === spec.kind) {
        host.spec = spec
        cue(host.playerId!, existing, spec.videoId, spec.start, spec.end)
        host.ready = true
        setReadyTick((value) => value + 1)
        return
      }
      if (host.playerId) destroyPlayer(host.playerId)
      counter.current += 1
      const id = `h${at}-${counter.current}`
      host.spec = spec
      host.playerId = id
      host.ready = false
      host.state = -1
      setReadyTick((value) => value + 1)
      try {
        await createPlayer({
          id,
          host: el,
          videoId: spec.videoId,
          start: spec.start,
          end: spec.end,
          kind: spec.kind,
          hidden: at !== visibleRef.current,
          onReady: (player) => {
            if (host.playerId !== id) return
            if (at !== visibleRef.current || !revealedRef.current) cue(id, player, spec.videoId, spec.start, spec.end)
            host.ready = true
            setReadyTick((value) => value + 1)
            if (at === visibleRef.current) tryPlay()
          },
          onState: (state) => host.playerId === id && onPlayerState(at, state),
          onError: (code) => host.playerId === id && window.dispatchEvent(new CustomEvent('hearts:player-error', { detail: { code, at } })),
        })
      } catch {
        if (host.playerId === id) setSlow('retry')
      }
    },
    [onPlayerState, tryPlay],
  )

  const stopVisible = () => {
    const host = hosts.current[visibleRef.current]
    if (host.playerId) getPlayer(host.playerId)?.stopVideo()
  }

  const preloadNext = useCallback(
    (fromIndex: number) => {
      if (lowData()) return
      const nextItem = itemsRef.current[fromIndex + 1]
      const spec = specFor(nextItem, 'hors')
      const hidden = visibleRef.current === 0 ? 1 : 0
      if (!spec) return
      const go = () => void prepare(hidden, spec)
      const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
      if (memory && memory <= 2 && hosts.current[visibleRef.current].state !== STATE.PLAYING) window.setTimeout(go, 1500)
      else go()
    },
    [prepare, specFor],
  )

  /** Shows item `at` in the slot: the hidden host takes over if it already holds it, otherwise the other host loads it. */
  const showItem = useCallback(
    async (at: number, kind: Mode = 'hors') => {
      const item = itemsRef.current[at]
      indexRef.current = at
      modeRef.current = kind
      setIndex(at)
      setMode(kind)
      setErrorNote(null)
      setSlow('none')
      setBuffering(false)
      setLineAt(0)
      watch.current = { key: `${item?.cutId}:${kind}`, start: kind === 'hors' ? item?.hors.start || 0 : item?.appetiser.start || 0, furthest: 0, done90: false }
      const spec = specFor(item, kind)
      if (!spec) {
        stopVisible()
        return
      }
      const current = visibleRef.current
      const other: 0 | 1 = current === 0 ? 1 : 0
      let target: 0 | 1 = other
      if (hosts.current[current].spec?.key === spec.key) target = current
      else if (hosts.current[other].spec?.key === spec.key) target = other
      else if (!hosts.current[current].playerId) target = current
      if (target !== current) stopVisible()
      setVisibleHost(target)
      await prepare(target, spec)
      tryPlay()
      if (kind === 'hors') preloadNext(at)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prepare, preloadNext, specFor, tryPlay],
  )

  useEffect(() => {
    tryPlay()
  }, [readyTick, revealed, tryPlay])

  // ---------- feed data ----------
  // The feed is routed here on the device from the bundled clip map: lane scores, the lead lane and served clips
  // never leave it (P1 and P2).
  const fetchFeed = useCallback(
    async (state: HeartState, justShow = false) => {
      const local = { ...ctx, now: Date.now() }
      let route: { items: FeedSlot[]; spinePointer: number } = routeFeed(state, local, { justShow })
      // Once the learner has seen everything, start the spine again rather than leave the feed empty.
      if (!route.items.length) route = buildFeed({ ...planFrom(state, local, { justShow }), served: [], spinePointer: 0 }, local)
      const clips = route.items
        .map((slot): FeedItem | null => {
          const clip = opening.clips[String(slot.cutId)]
          if (!clip) return null
          return slot.laneKey ? { ...clip, laneKey: slot.laneKey, lane: slot.laneKey, laneLabel: opening.laneTitles[slot.laneKey] || clip.laneLabel } : { ...clip, laneKey: null }
        })
        .filter((clip): clip is FeedItem => Boolean(clip))
      return { items: route.items, clips, spinePointer: route.spinePointer }
    },
    [ctx, opening.clips, opening.laneTitles],
  )

  const adopt = useCallback(
    (clips: FeedItem[], slots: FeedSlot[], spinePointer: number, replace: boolean) => {
      const merged = replace ? clips : [...itemsRef.current, ...clips.filter((clip) => !itemsRef.current.some((row) => row.id === clip.id))]
      itemsRef.current = merged
      setItems(merged)
      if (heartRef.current) setHeart(markServed(heartRef.current, slots, spinePointer))
    },
    [setHeart],
  )

  const refill = useCallback(async () => {
    if (refilling.current || !heartRef.current) return
    if (itemsRef.current.length - indexRef.current - 1 > 2) return
    refilling.current = true
    try {
      const data = await fetchFeed(heartRef.current)
      adopt(mixFeed(data.clips, heartRef.current?.served.length || 0, backgroundsBase), data.items, data.spinePointer, false)
    } catch {
      // Offline: carry on with what is here.
    } finally {
      refilling.current = false
    }
  }, [adopt, backgroundsBase, fetchFeed])

  // Arriving straight at the feed (a returning visitor, or Home › feed).
  useEffect(() => {
    if (props.initial !== 'feed') return
    let cancelled = false
    const begin = async () => {
      await wait(0)
      const state = heartRef.current
      if (!state) return
      setFirstEver(state.served.length === 0)
      revealedRef.current = true
      setRevealed(true)
      try {
        const data = await fetchFeed(state)
        if (cancelled) return
        let clips = data.clips
        let firstMode: Mode = 'hors'
        if (props.lane) {
          const own = laneClips(opening.clips, opening.route.cuts, props.lane, opening.laneTitles[props.lane] || props.lane)
          if (own.length) clips = [...own, ...clips.filter((clip) => !own.some((row) => row.cutId === clip.cutId))]
        }
        const asked = props.clip ? opening.clips[String(props.clip)] : undefined
        if (asked) {
          clips = [{ ...asked, laneKey: null }, ...clips.filter((clip) => clip.cutId !== asked.cutId)]
          if (props.play === 'appetiser') firstMode = 'appetiser'
        }
        clips = mixFeed(clips, state.served.length, backgroundsBase)
        adopt(clips, data.items, data.spinePointer, true)
        await showItem(0, firstMode)
        if (!data.clips[0]?.youtubeId || data.clips[0]?.style) window.setTimeout(() => setTabs(true), 1200)
      } catch {
        setOffline(!navigator.onLine)
        setTabs(true)
      }
    }
    void begin()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A short clip keeps the transcript line at the timestamp on screen. The server copies the words; this only sends the time.
  useEffect(() => {
    if (!signedIn || props.viewAs || phase !== 'feed') return
    const current = items[index]
    if (!current?.lessonId) return
    const piece = mode === 'hors' ? current.hors : current.appetiser
    const line = piece.lines?.[Math.min(lineAt, Math.max(0, (piece.lines?.length || 1) - 1))]
    const at = line?.at
    const seconds = typeof at === 'number' && Number.isFinite(at) ? at : mode === 'hors' ? current.hors.start : current.appetiser.start
    if (!Number.isFinite(seconds)) return
    const key = `${current.lessonId}:${mode}:${Math.round(seconds)}`
    if (gathered.current.has(key)) return
    gathered.current.add(key)
    void fetch('/api/hearts/harvest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lessonId: current.lessonId, seconds, surface: mode }),
    }).then((response) => {
      if (!response.ok) gathered.current.delete(key)
    }).catch(() => {
      gathered.current.delete(key)
    })
  }, [signedIn, props.viewAs, phase, items, index, mode, lineAt])

  // ---------- opening flow ----------
  const sceneEnter = useCallback((direction: 'up' | 'back' | 'fade') => {
    const el = sceneRef.current
    const out = leavingRef.current
    if (direction === 'up') {
      animate(out, [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-12%)', opacity: 0 }], T.exit, EASE.exit, { id: 'scene-exit' })
      return animate(el, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], T.scene, EASE.enter, { id: 'scene-enter' })
    }
    if (direction === 'back') {
      animate(out, [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(100%)', opacity: 1 }], 350, EASE.standard, { id: 'scene-back-out' })
      return animate(el, [{ transform: 'translateY(-12%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], 350, EASE.standard, { id: 'scene-back' })
    }
    return animate(el, [{ opacity: 0 }, { opacity: 1 }], T.reduced, EASE.standard, { id: 'scene-fade' })
  }, [])

  const pendingEnter = useRef<'up' | 'back' | 'fade' | null>(null)
  useLayoutEffect(() => {
    const direction = pendingEnter.current
    if (!direction) return
    pendingEnter.current = null
    const animation = sceneEnter(direction)
    void finished(animation).then(() => setLeaving(null))
  }, [sceneAt, phase, sceneEnter])

  const goScene = (next: number, direction: 'up' | 'back' | 'fade', from: number | null) => {
    setLeaving(from)
    pendingEnter.current = direction
    setReply(null)
    setPicked(null)
    setSceneAt(next)
    setPhase('scene')
  }

  const provisional = useRef<number | null>(null)
  // Scene 6 mount: one hidden player, cued with the provisional lead lane's first cut (7A.3 T5).
  useEffect(() => {
    if (phase !== 'scene' || sceneAt !== scenes.length - 1 || lowData() || !heartRef.current) return
    const route = routeFeed(heartRef.current, ctx)
    const first = route.items[0]
    const item = first ? opening.starters[String(first.cutId)] : undefined
    const spec = specFor(item, 'hors')
    if (spec && !hosts.current[0].playerId && !hosts.current[1].playerId) {
      provisional.current = first.cutId
      setVisibleHost(0)
      void prepare(0, spec)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sceneAt])

  // One tap moves one scene: further taps are ignored until the next scene (or phase) is on screen.
  const tapLock = useRef(false)
  useEffect(() => {
    tapLock.current = false
  }, [sceneAt, phase])
  const takeTap = () => {
    if (tapLock.current) return false
    tapLock.current = true
    return true
  }

  const letsPlay = () => {
    if (!takeTap()) return
    haptic(10)
    preloadApi()
    depth.current += 1
    push(`${base}/start/1`, { scene: 0 })
    goScene(0, reducedMotion() ? 'fade' : 'up', null)
    const outgoing = document.querySelector('[data-screen="opener"]')
    animate(outgoing, [{ opacity: 1 }, { opacity: 0 }], T.fade, EASE.exit)
  }

  const handOff = useCallback(
    async (justShow: boolean, doorEl: HTMLElement | null) => {
      const state = heartRef.current
      if (!state) return
      if (props.afterPlacing && props.signedIn && props.learner) {
        const handed = { ...state, handedOffAt: Date.now(), synced: true }
        setHeart(handed)
        if (!props.viewAs) {
          document.cookie = `hearts_opened=1; Path=/p/${opening.portal}; Max-Age=31536000; SameSite=Lax`
          try {
            await fetch(`/api/workbook/opening?portal=${opening.portal}`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ scenesVersion: state.scenesVersion, taps: state.taps.map((tap) => ({ sceneKey: tap.scene, optionKey: tap.option, answeredAt: tap.at })) }),
            })
          } catch {
            // The result screen still opens. Home sends them back to the quiz if the opening was not saved.
          }
        }
        window.location.assign(`${base}/welcome?step=done`)
        return
      }
      preloadApi()
      const route = routeFeed(state, ctx, { justShow })
      const first = route.items[0]
      const starter = first ? opening.starters[String(first.cutId)] : undefined
      const handed = { ...state, handedOffAt: Date.now() } as HeartState
      setHeart(handed)
      if (!props.viewAs) document.cookie = `hearts_opened=1; Path=/p/${opening.portal}; Max-Age=31536000; SameSite=Lax`
      if (starter) {
        itemsRef.current = [starter]
        setItems([starter])
      }
      setFirstEver(true)
      setLine(justShow ? props.opener.justShow : props.opener.handOff)
      setPhase('handoff')
      performance.mark('door-tap')
      const doorAnimation = doorEl && !justShow ? animate(doorEl, [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }], T.calm, EASE.calm, { id: 'door' }) : null
      if (doorEl && !justShow) haptic(20)
      else haptic(10)
      const layer = document.querySelector('[data-testid="scene-layer"]')
      if (justShow) animate(layer, [{ opacity: 1 }, { opacity: 0 }], 300, EASE.standard, { id: 'just-show' })
      else void finished(doorAnimation).then(() => animate(layer, [{ opacity: 1 }, { opacity: 0 }], T.fade, EASE.exit))
      const lineAnimation = animate(document.querySelector('[data-testid="handoff-line"]'), [{ opacity: 0 }, { opacity: 1 }], T.exit, EASE.standard, { delay: 200, id: 'handoff-line' })
      void lineAnimation
      // Back from the feed must never reopen the scenes: step back over them, then replace that entry.
      if (depth.current > 0) {
        rewinding.current = `${base}/feed`
        window.history.go(-depth.current)
        depth.current = 0
      } else window.history.replaceState(window.history.state, '', `${base}/feed`)
      const spec = specFor(starter, 'hors')
      indexRef.current = 0
      setIndex(0)
      watch.current = { key: `${starter?.cutId}:hors`, start: starter?.hors.start || 0, furthest: 0, done90: false }
      if (spec) {
        const holder: 0 | 1 = hosts.current[0].playerId ? 0 : hosts.current[1].playerId ? 1 : 0
        setVisibleHost(holder)
        void prepare(holder, spec)
      }
      const feed = fetchFeed(state, justShow).catch(() => null)
      await wait(1400)
      const slowTimer = window.setTimeout(() => {
        if (!firstPlaying.current) setSlow('breathe')
      }, 1600)
      const retryTimer = window.setTimeout(() => {
        if (!firstPlaying.current) setSlow('retry')
      }, 6600)
      setLine(null)
      revealedRef.current = true
      setRevealed(true)
      setPhase('feed')
      tryPlay()
      const data = await feed
      if (data) {
        adopt(data.clips.length ? data.clips : itemsRef.current, data.items, data.spinePointer, true)
        if (!starter && data.clips[0]) await showItem(0)
        else preloadNext(0)
      }
      if (!spec) window.setTimeout(() => setTabs(true), 600)
      void slowTimer
      void retryTimer
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [adopt, ctx, fetchFeed, opening, prepare, preloadNext, props.opener, props.viewAs, setHeart, showItem, specFor, tryPlay],
  )

  const justShow = () => void handOff(true, null)

  const pick = async (option: SceneOption, el: HTMLElement) => {
    const state = heartRef.current
    const scene = scenes[sceneAt]
    if (!state || !scene || !takeTap()) return
    const outcome = applyTap(state, scene.key, option.key, scenes, opening.scales)
    if (outcome.crisis) {
      push(`${base}/help`, { help: true })
      depth.current += 1
      const layer = document.querySelector('[data-testid="scene-layer"]')
      await finished(animate(layer, [{ opacity: 1 }, { opacity: 0 }], 200, EASE.standard))
      setPhase('help')
      return
    }
    haptic(10)
    setHeart(outcome.state)
    setPicked(option.key)
    animate(el, [{ transform: 'scale(1)' }, { transform: 'scale(1.03)' }], T.tap, EASE.standard, { id: 'tile-lift' })
    if (sceneAt === scenes.length - 1) {
      await wait(T.tap)
      void handOff(false, el)
      return
    }
    setReply(option.replyPill || null)
    await wait(T.fade + HOLD)
    depth.current += 1
    push(`${base}/start/${sceneAt + 2}`, { scene: sceneAt + 1 })
    goScene(sceneAt + 1, reducedMotion() ? 'fade' : 'up', sceneAt)
  }

  const pass = async () => {
    const state = heartRef.current
    const scene = scenes[sceneAt]
    if (!state || !scene || !takeTap()) return
    setHeart(applyTap(state, scene.key, 'pass', scenes, opening.scales).state)
    if (sceneAt === scenes.length - 1) return void handOff(false, null)
    await finished(animate(document.querySelector('.j-choices'), [{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(-110%)', opacity: 0 }], 200, EASE.exit, { id: 'pass' }))
    depth.current += 1
    push(`${base}/start/${sceneAt + 2}`, { scene: sceneAt + 1 })
    goScene(sceneAt + 1, reducedMotion() ? 'fade' : 'up', sceneAt)
  }

  const backToHearts = () => {
    window.history.replaceState(window.history.state, '', `${base}/start`)
    setPhase('opener')
    pendingEnter.current = 'fade'
  }

  const resume = () => {
    const answered = new Set(heartRef.current?.taps.map((tap) => tap.scene) || [])
    const next = Math.max(0, scenes.findIndex((scene) => !answered.has(scene.key)))
    if (!takeTap()) return
    haptic(10)
    preloadApi()
    depth.current += 1
    push(`${base}/start/${next + 1}`, { scene: next })
    goScene(next, reducedMotion() ? 'fade' : 'up', null)
  }

  useEffect(() => {
    const onPop = () => {
      const path = window.location.pathname
      if (rewinding.current) {
        window.history.replaceState(window.history.state, '', rewinding.current)
        rewinding.current = null
        return
      }
      if (sheetRef.current) {
        sheetRef.current = null
        setSheet(null)
        window.setTimeout(() => tryPlay(), 0)
        return
      }
      const feedNow = phaseRef.current === 'feed' || phaseRef.current === 'handoff'
      if (feedNow) {
        if (path.endsWith('/start') || /\/start\/\d+$/.test(path) || path.endsWith('/help')) {
          window.history.go(1)
          return
        }
        if (modeRef.current === 'appetiser') void showItem(indexRef.current, 'hors')
        return
      }
      const match = path.match(/\/start\/(\d+)$/)
      depth.current = Math.max(0, depth.current - 1)
      if (match) {
        const target = Number(match[1]) - 1
        if (phaseRef.current === 'help') {
          setPhase('scene')
          pendingEnter.current = 'fade'
          setSceneAt(target)
          return
        }
        goScene(target, reducedMotion() ? 'fade' : 'back', sceneAtRef.current)
      } else if (path.endsWith('/start')) {
        setPhase('opener')
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showItem, tryPlay])

  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const sceneAtRef = useRef(sceneAt)
  sceneAtRef.current = sceneAt

  // ---------- feed behaviour ----------
  const item = items[index]
  const laneTags = useMemo(() => (item?.laneTags?.length ? item.laneTags : item?.laneKey ? [{ lane: item.laneKey, weight: 1 }] : []), [item])

  const signal = useCallback(
    (kind: Signal, tags = laneTags) => {
      if (!heartRef.current || !tags.length) return
      setHeart(applySignal(heartRef.current, tags, kind))
    },
    [laneTags, setHeart],
  )

  const noteBrowse = useCallback((event: 'linger' | 'learn-more') => {
    if (!signedIn) return
    const current = itemsRef.current[indexRef.current]
    const level = modeRef.current
    if (!current || (level !== 'hors' && level !== 'appetiser')) return
    const piece = level === 'hors' ? current.hors : current.appetiser
    const parent = (level === 'hors' ? current.parents?.hors.parentId : current.parents?.appetiser.parentId) || ''
    const form = new FormData()
    form.set('action', 'browse')
    form.set('level', level)
    form.set('event', event)
    form.set('lesson', String(current.lessonId))
    form.set('speaker', current.speaker)
    form.set('speakerSlug', current.speakerSlug)
    form.set('start', String(Math.floor(piece.start)))
    form.set('end', String(Math.ceil(piece.end)))
    form.set('parent', parent)
    void fetch('/api/hearts', { method: 'POST', headers: { accept: 'application/json' }, body: form }).catch(() => undefined)
  }, [signedIn])

  const leaveSignal = useCallback(() => {
    const seen = watch.current
    if (!seen.key || seen.done90 || modeRef.current !== 'hors') return
    if (seen.furthest < 3) signal('skip-under-3')
    else if (seen.furthest < 10) signal('skip-3-10')
  }, [signal])

  const openSheet = useCallback((reason: SheetReason) => {
    const flagsNow = sessionFlags()
    if (flagsNow.sheetCount >= 2) return false
    setSessionFlags({ ...flagsNow, sheetCount: flagsNow.sheetCount + 1 })
    const host = hosts.current[visibleRef.current]
    if (host.playerId) getPlayer(host.playerId)?.pauseVideo()
    sheetRef.current = reason
    setSheet(reason)
    push(window.location.pathname, { sheet: true })
    return true
  }, [])

  const advance = useCallback(
    async (to: number, how: 'swipe' | 'auto' = 'swipe') => {
      const list = itemsRef.current
      if (!list.length) return
      // Whatever moves the feed, it stays on the level being watched.
      const target = settleOnLevel(list, to, modeRef.current, to < indexRef.current ? -1 : 1)
      if (target === null) return
      if (how === 'swipe') leaveSignal()
      if (how === 'swipe' && clipRef.current) {
        await finished(animate(clipRef.current, [{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }], T.snap, EASE.standard, { id: 'snap' }))
      }
      setFirstEver(false)
      // A swipe moves along the level being watched; only "Learn more" goes up a level.
      await showItem(target, modeRef.current)
      if (clipRef.current) clipRef.current.getAnimations().forEach((animation) => animation.cancel())
      void refill()
    },
    [leaveSignal, refill, showItem],
  )

  useEffect(() => {
    const onEnded = () => {
      if (modeRef.current !== 'hors') return
      const flagsNow = sessionFlags()
      if (!signedIn && !flagsNow.firstEnded) {
        setSessionFlags({ ...sessionFlags(), firstEnded: true })
        if (openSheet('ended')) {
          pendingAfterSheet.current = 'next'
          return
        }
      }
      void advance(indexRef.current + 1, 'auto')
    }
    const onError = (event: Event) => {
      const { code, at } = (event as CustomEvent<{ code: number; at: number }>).detail
      if (at !== visibleRef.current || !UNPLAYABLE.has(code)) return
      const current = itemsRef.current[indexRef.current]
      setErrorNote("This one can't play here")
      if (current && signedIn) void fetch('/api/hearts/unplayable', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cutId: current.cutId, code }) }).catch(() => undefined)
      window.setTimeout(() => void advance(indexRef.current + 1, 'auto'), 900)
    }
    window.addEventListener('hearts:ended', onEnded)
    window.addEventListener('hearts:player-error', onError)
    return () => {
      window.removeEventListener('hearts:ended', onEnded)
      window.removeEventListener('hearts:player-error', onError)
    }
  }, [advance, openSheet, signedIn])

  const pendingAfterSheet = useRef<'next' | null>(null)
  const closeSheet = () => {
    sheetRef.current = null
    setSheet(null)
    if (window.history.state?.hearts?.sheet) window.history.back()
    if (pendingAfterSheet.current === 'next') {
      pendingAfterSheet.current = null
      void advance(indexRef.current + 1, 'auto')
    } else window.setTimeout(() => tryPlay(), 0)
  }

  // Poll while playing: how far the learner got, and the 90% mark.
  useEffect(() => {
    if (phase !== 'feed') return
    const timer = window.setInterval(() => {
      const host = hosts.current[visibleRef.current]
      if (host.state !== STATE.PLAYING || !host.playerId) return
      const player = getPlayer(host.playerId)
      const current = itemsRef.current[indexRef.current]
      if (!player || !current) return
      const time = player.getCurrentTime()
      const seen = watch.current
      seen.furthest = Math.max(seen.furthest, time - seen.start)
      // The player's own end mark is skipped when someone seeks past it, so the appetiser stops here as well.
      const lines = modeRef.current === 'hors' ? current.hors.lines : current.appetiser.lines
      const showing = captionIndex(lines, time)
      setLineAt((held) => (held === showing ? held : showing))
      setSpokenAt((held) => (held !== null && Math.abs(held - time) < 0.35 ? held : time))
      const spans = current.appetiser.spans
      if (modeRef.current === 'appetiser' && spans && spans.length > 1) {
        const join = appetiserJoin(spans, time)
        if (join.action === 'seek' && join.at != null) {
          if (spanJoin.current !== join.at) {
            spanJoin.current = join.at
            player.seekTo(join.at, true)
          }
          return
        }
        spanJoin.current = null
        if (join.action === 'stop') {
          player.pauseVideo()
          player.seekTo(spans[spans.length - 1].end, true)
          if (!seen.done90) {
            seen.done90 = true
            noteBrowse('linger')
          }
          return
        }
      } else if (modeRef.current === 'appetiser' && time >= appetiserEnd(current) - 0.25) {
        player.pauseVideo()
        player.seekTo(appetiserEnd(current), true)
        if (!seen.done90) {
          seen.done90 = true
          noteBrowse('linger')
        }
        return
      }
      // The player's own end mark is a whole second; the clip stops at its real out point, between sentences.
      if (modeRef.current === 'hors' && current.hors.end > current.hors.start && time >= current.hors.end) {
        player.pauseVideo()
        if (!seen.done90) {
          seen.done90 = true
          signal('watched90')
          noteBrowse('linger')
        }
        window.dispatchEvent(new CustomEvent('hearts:ended'))
        return
      }
      if (modeRef.current === 'hors' && !seen.done90) {
        const length = current.hors.end - current.hors.start
        if (length > 0 && seen.furthest >= 0.9 * length) {
          seen.done90 = true
          signal('watched90')
          noteBrowse('linger')
        }
      }
    }, 250)
    return () => window.clearInterval(timer)
  }, [phase, signal, noteBrowse])

  const needsAccount = (reason: SheetReason) => {
    if (signedIn) return false
    if (!openSheet(reason)) setToast('Log in from the top of the opener to keep things.')
    return true
  }

  const replay = () => {
    signal('replay')
    void showItem(indexRef.current, modeRef.current)
    const host = hosts.current[visibleRef.current]
    if (host.playerId && host.spec) getPlayer(host.playerId)?.seekTo(host.spec.start, true)
    setToast('Playing this clip again')
  }
  const swipeTo = (swipe: Swipe) => {
    const current = itemsRef.current[indexRef.current]
    if (!current) return
    const target = swipeTarget(itemsRef.current, indexRef.current, modeRef.current, swipe)
    if (target === null) {
      if (swipe === 'speaker') return setToast(`That is everything from ${current.speaker} for now`)
      if (swipe === 'topic') return setToast('That is everything on this topic for now')
      return setToast(modeRef.current === 'hors' ? "That is the only hors d'oeuvre here" : 'That is the only appetiser here')
    }
    if (swipe === 'lane') setToast(`Lane · ${itemsRef.current[target]?.laneLabel || ''}`)
    if (swipe === 'topic') setToast('More on this topic')
    if (swipe === 'speaker') setToast(`More from ${current.speaker}`)
    void advance(target)
  }
  const nextLane = () => swipeTo('lane')
  const moreLikeThis = () => swipeTo('topic')
  const moreFromSpeaker = () => swipeTo('speaker')
  const stepLoop = (direction: 1 | -1) => swipeTo(direction === 1 ? 'next' : 'prev')

  const stepUp = async (event?: React.MouseEvent<HTMLAnchorElement>) => {
    const current = itemsRef.current[indexRef.current]
    if (!current) return
    const step = learnMoreTarget(itemsRef.current, indexRef.current, modeRef.current, base)
    if (!step) return
    if (step.level === 'appetiser') {
      signal('watch-full')
      noteBrowse('learn-more')
      const url = new URL(window.location.href)
      url.searchParams.set('clip', String(step.cutId))
      url.searchParams.set('play', 'appetiser')
      push(`${url.pathname}${url.search}`, { appetiser: step.cutId })
      void showItem(step.index, 'appetiser')
      return
    }
    event?.preventDefault()
    if (needsAccount('save')) return
    signal('start-course')
    noteBrowse('learn-more')
    haptic(10)
    stopVisible()
    const node = event?.currentTarget
    if (node) await finished(animate(node, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.6)', opacity: 0 }], 500, EASE.enter, { id: 'mains-transform' }))
    router.push(step.href)
  }

  const fave = () => {
    if (!item) return
    if (needsAccount('save')) return
    if (!faves.includes(item.id)) signal('fave')
    toggleFave(item.id)
  }

  const share = async () => {
    if (!item) return
    const url = `${window.location.origin}${base}/feed`
    try {
      if (navigator.share) await navigator.share({ title: item.courseTitle, url })
      else {
        await navigator.clipboard.writeText(url)
        setToast('Link copied')
      }
    } catch {
      setToast('Sharing was cancelled')
    }
  }

  const tapSound = () => {
    const host = hosts.current[visibleRef.current]
    if (host.playerId) soundOn(host.playerId)
    if (typeRef.current) typeRef.current.muted = false
    setMuted(false)
  }

  const retry = () => {
    const host = hosts.current[visibleRef.current]
    const spec = host.spec
    if (!spec) return
    if (host.playerId) destroyPlayer(host.playerId)
    host.playerId = null
    host.spec = null
    setSlow('none')
    void prepare(visibleRef.current, spec)
  }

  useEffect(() => {
    if (!offline && phase === 'feed' && revealed) {
      const host = hosts.current[visibleRef.current]
      if (!host.playerId && item) void showItem(indexRef.current, modeRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offline])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 1600)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    for (const row of items.slice(index + 1, index + 6)) {
      const src = row.scene?.scene
      if (!src) continue
      const image = new Image()
      image.src = src
    }
  }, [items, index])

  // Gestures on the clip. In overlay mode the gesture layer covers the player; in strict mode only the chrome.
  const onDown = (event: ReactPointerEvent) => {
    if (!(event.target as HTMLElement).closest('button, a')) (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
    const timer = window.setTimeout(() => {
      if (gesture.current && !gesture.current.moved) setNotForMe(true)
    }, 650)
    gesture.current = { x: event.clientX, y: event.clientY, t: performance.now(), moved: false, timer }
  }
  const onMove = (event: ReactPointerEvent) => {
    const start = gesture.current
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 8) start.moved = true
    if (clipRef.current && Math.abs(dx) > Math.abs(dy) && start.moved) clipRef.current.style.transform = `translateX(${dx}px)`
  }
  const onUp = (event: ReactPointerEvent) => {
    const start = gesture.current
    gesture.current = null
    if (!start) return
    if (start.timer) window.clearTimeout(start.timer)
    if (clipRef.current) clipRef.current.style.transform = ''
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    const elapsed = Math.max(1, performance.now() - start.t)
    const width = clipRef.current?.clientWidth || 390
    const far = Math.max(Math.abs(dx), Math.abs(dy))
    const quick = far / elapsed >= 0.5
    if (far < 40 || (far < width * 0.25 && !quick)) {
      if (!start.moved && overlay && !slide) {
        const host = hosts.current[visibleRef.current]
        const player = host.playerId ? getPlayer(host.playerId) : null
        if (player && host.state === STATE.PLAYING) player.pauseVideo()
        else tryPlay()
      }
      return
    }
    if (Math.abs(dy) > Math.abs(dx)) {
      if (dy < 0) replay()
      else nextLane()
    } else if (dx < 0) moreLikeThis()
    else moreFromSpeaker()
  }
  const onCancel = () => {
    const start = gesture.current
    gesture.current = null
    if (start?.timer) window.clearTimeout(start.timer)
    if (clipRef.current) clipRef.current.style.transform = ''
  }
  const swipe = { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onCancel }

  // ---------- sign-up from the sheet ----------
  const signUp = async (account: { name: string; email: string; password: string }) => {
    const state = heartRef.current
    const response = await fetch(`/api/workbook/opening?portal=${opening.portal}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scenesVersion: state?.scenesVersion || opening.scenesVersion, taps: (state?.taps || []).map((tap) => ({ sceneKey: tap.scene, optionKey: tap.option, answeredAt: tap.at })), account }),
    }).catch(() => null)
    if (!response) return 'That did not go through. Check your connection and try again.'
    const data = (await response.json().catch(() => ({}))) as { error?: string }
    if (!response.ok) return data.error || 'That did not go through. Please try again.'
    haptic([15, 60, 15])
    if (state) setHeart({ ...state, synced: true } as HeartState)
    const pending = readPending()
    if (pending.length) {
      writePending([])
      await fetch('/api/answers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pending }) }).catch(() => writePending(pending))
    }
    setSignedIn(true)
    sheetRef.current = null
    setSheet(null)
    setToast('Your place is kept.')
    window.setTimeout(() => tryPlay(), 300)
    return null
  }

  // ---------- render ----------
  const host = hosts.current[visibleHost]
  const currentSpec = specFor(item, mode)
  const playerReady = Boolean(currentSpec && host.ready && host.spec?.key === currentSpec.key && revealed)
  const cardKind = mode === 'hors' && (item?.card === 'film' || item?.card === 'text' || item?.card === 'question' || item?.card === 'scene') ? item!.card : null
  const typeSrc = cardKind === 'film' ? item?.film?.src : item?.typography?.src
  const typeClip = Boolean(phase === 'feed' && mode === 'hors' && typeSrc && cardKind !== 'text' && cardKind !== 'question' && cardKind !== 'scene')
  const scenic = Boolean(phase === 'feed' && cardKind === 'scene' && mode === 'hors' && item?.scene)
  const showPoster = !typeClip && !scenic && (phase === 'handoff' || (phase === 'feed' && (!playerReady || Boolean(errorNote) || offline)))
  const piece = item ? (mode === 'hors' ? item.hors : item.appetiser) : null
  const lineShown = piece?.lines?.length ? Math.min(lineAt, piece.lines.length - 1) : 0
  const captionLine = piece?.lines?.[lineShown]
  const until = piece?.lines?.[lineShown + 1]?.at ?? (item && mode === 'appetiser' ? appetiserEnd(item) : (captionLine?.at ?? 0) + 8)
  const captionText = (piece?.lines?.length
    ? (mode === 'appetiser' && captionLine ? captionPage(captionLine.text, captionLine.at, until, spokenAt ?? captionLine.at).text : captionLine?.text || '')
    : piece?.quote) || ''
  const captionRole = mode === 'appetiser' ? captionLine?.role || null : null
  useEffect(() => {
    setCaptionOpen(false)
  }, [item?.id, mode])
  const slide = phase === 'feed' && mode === 'hors' && item?.style && !typeClip ? item.style : null
  const course = (item && learnMore(item, 'appetiser', base)?.href) || base
  const horsParent = item?.parents?.hors
  const appetiserParent = item?.parents?.appetiser
  const captionButton = item ? (
    <button
      type="button"
      className={`caption${captionText.length > 120 ? ' long' : ''}${captionText ? '' : ' title-only'}`}
      data-testid="caption"
      data-line={lineShown}
      data-role={captionRole || undefined}
      data-expanded={captionOpen ? 'true' : 'false'}
      aria-expanded={captionOpen}
      key={mode}
      onPointerDown={(event) => {
        event.stopPropagation()
        captionDrag.current = false
        event.currentTarget.setPointerCapture(event.pointerId)
        onDown(event)
      }}
      onPointerMove={onMove}
      onPointerCancel={onCancel}
      onPointerUp={(event) => {
        const start = gesture.current
        if (!start) return
        const far = Math.max(Math.abs(event.clientX - start.x), Math.abs(event.clientY - start.y))
        if (far >= 40) {
          captionDrag.current = true
          onUp(event)
          return
        }
        if (start.timer) window.clearTimeout(start.timer)
        gesture.current = null
      }}
      onClick={() => {
        if (captionDrag.current) {
          captionDrag.current = false
          return
        }
        setCaptionOpen((open) => !open)
      }}
    >
      {captionText || item.lessonTitle || item.courseTitle}
    </button>
  ) : null
  const laneVisible = Boolean(item) && !firstEver
  void readyTick

  const chrome = item && phase === 'feed' && !slide && !scenic ? (
    <>
      <div className="j-hairline-row">
        <div className={`j-hairline${buffering ? ' shimmer' : ''}`} data-testid="hairline"><i /></div>
        {mode === 'hors' ? (
          <div className="clip-row">
            {laneVisible ? <span className="chip white" data-testid="lane-chip">Lane · {item.laneLabel}</span> : <span data-testid="lane-chip-hidden" />}
            {!typeClip && muted && !hasSound() && playerReady ? <button type="button" className="j-sound" onClick={tapSound} data-testid="tap-sound">Tap for sound</button> : null}
            <span className="chip dark">{clock(item.hors.end - item.hors.start)}</span>
          </div>
        ) : (
          <div className="clip-row">
            <button type="button" className="chip white" onClick={() => window.history.back()} data-testid="appetiser-back">‹ Back</button>
            {!typeClip && muted && !hasSound() && playerReady ? <button type="button" className="j-sound" onClick={tapSound} data-testid="tap-sound">Tap for sound</button> : null}
            <span className="chip gold">Extended cut</span>
          </div>
        )}
      </div>
      {typeClip && muted ? (
        <button type="button" className="j-sound" onClick={tapSound} data-testid="tap-sound">Tap for sound</button>
      ) : null}
      {(cardKind && cardKind !== 'scene') || typeClip ? null : mode === 'appetiser' ? (
        <div className="beat-stack">
          <div className="beat-card" data-testid="caption-panel">
            {(piece?.lines?.length || 0) > 1 ? (
              <div className="beat-rail" data-testid="beat-rail" data-beat={captionRole || 'hook'} style={{ ['--i' as string]: lineShown }}>
                <i className="glide" />
                {(['hook', 'turn', 'land'] as const).map((role) => (
                  <span key={role} className={captionRole === role ? 'on' : ''}>{role === 'hook' ? 'Hook' : role === 'turn' ? 'Turn' : 'Land'}</span>
                ))}
              </div>
            ) : null}
            {captionButton}
          </div>
        </div>
      ) : captionButton}
      <div className="rail">
        <button type="button" onClick={share} data-testid="share"><span className="bubble"><ShareIcon /></span>Share</button>
        <button type="button" aria-pressed={faves.includes(item.id)} onClick={fave} data-testid="fave"><span className="bubble"><HeartIcon filled={faves.includes(item.id)} /></span>Like</button>
        <button type="button" aria-pressed={saved.includes(item.id)} onClick={() => !needsAccount('save') && toggleSave(item.id)} data-testid="save"><span className="bubble"><SaveIcon /></span>{saved.includes(item.id) ? 'Saved' : 'Save'}</button>
      </div>
      <div className="clip-foot">
        {mode === 'hors' ? (
          <>
            <div className="j-speaker">
              <a className="speaker-row" href={`${base}/speaker/${item.speakerSlug}`} data-testid="speaker-link" onClick={(event) => { if (needsAccount('save')) event.preventDefault() }}>
                <Avatar name={item.speaker} portrait={item.portrait} />
                <span className="who"><b>{item.speaker}</b><small>{laneVisible ? `on ${item.laneLabel}` : item.courseTitle}</small></span>
              </a>
              <span onClickCapture={(event) => { if (needsAccount('save')) { event.preventDefault(); event.stopPropagation() } }}><FollowButton slug={item.speakerSlug} /></span>
            </div>
            <button type="button" className="pill gold block" data-testid="learn-more" data-parent={horsParent?.parentId || ''} data-parent-level="appetiser" onClick={() => void stepUp()}>Learn more</button>
          </>
        ) : (
          <>
            <a className="pill gold block" href={course} onClick={(event) => void stepUp(event)} data-testid="learn-more" data-parent={appetiserParent?.parentId || ''} data-parent-level="talk">Learn more</a>
            <div className="speaker-card">
              <Avatar name={item.speaker} portrait={item.portrait} />
              <a className="who" href={`${base}/speaker/${item.speakerSlug}`} data-testid="speaker-bio-link"><b>{item.speaker}</b><small>{item.courseTitle}</small></a>
              <FollowButton slug={item.speakerSlug} className="follow teal" />
            </div>
          </>
        )}
      </div>
    </>
  ) : null

  return (
    <div className={`journey ${overlay ? 'overlay' : 'strict'} phase-${phase}`} data-testid="journey" data-phase={phase} data-mode={mode} data-index={index} data-card={cardKind || 'talk'} data-cut={item?.cutId ?? ''} data-lesson={item?.lessonId ?? ''} data-cuts={items.map((row) => row.cutId).join(' ')} data-lane={item?.lane || ''} data-speaker={item?.speaker || ''} data-speaker-slug={item?.speakerSlug || ''} data-chrome={overlay ? 'over' : 'around'}>
      <div className="j-sky" aria-hidden>
        {Array.from({ length: 8 }, (_, at) => (
          <div key={at} ref={(el) => { skyRefs.current[at] = el }} className={`j-sky-layer s${at}`} style={{ opacity: at === 0 ? 1 : 0 }} />
        ))}
      </div>

      <div ref={clipRef} className="j-clip" data-screen={phase === 'feed' || phase === 'handoff' ? 'clip' : undefined}>
        <div ref={slotRef} className="j-slot" data-testid="player-slot" style={{ visibility: phase === 'feed' || phase === 'handoff' ? 'visible' : 'hidden' }}>
          {[0, 1].map((at) => (
            <div
              key={at}
              ref={(el) => { hostEls.current[at] = el }}
              className={`yt-host ${at === visibleHost && revealed && !slide && !scenic ? 'on' : 'off'}`}
              data-testid={at === visibleHost && revealed ? 'player-visible' : 'player-hidden'}
              style={{ visibility: at === visibleHost && playerReady && !showPoster ? 'visible' : 'hidden' }}
            />
          ))}
          {typeClip && typeSrc ? (
            <video
              key={item?.id}
              ref={typeRef}
              className="typography-player"
              src={typeSrc}
              poster={item?.poster || undefined}
              playsInline
              muted
              autoPlay
              data-testid="typography-player"
              data-style={cardKind === 'film' ? item?.film?.style : item?.typography?.style}
              onEnded={() => window.dispatchEvent(new CustomEvent('hearts:ended'))}
            />
          ) : null}
          {phase === 'feed' && cardKind === 'question' && item ? (
            <div className="feed-card" data-testid="feed-question">
              <div className="kicker">Question</div>
              <h2>{item.prompt}</h2>
              <p>{item.speaker}</p>
              <button type="button" className="pill gold" onClick={() => void advance(index + 1)} data-testid="feed-card-next">Continue</button>
            </div>
          ) : phase === 'feed' && cardKind === 'text' && item?.film ? (
            <div className="feed-card" data-testid="feed-text">
              <div className="kicker">{item.film.beat === 'hook' ? 'Hook' : item.film.beat === 'turn' ? 'Turn' : 'Land'}</div>
              <h2>{item.film.quote}</h2>
              <p>{item.speaker}</p>
              <button type="button" className="pill gold" onClick={() => void advance(index + 1)} data-testid="feed-card-next">Continue</button>
            </div>
          ) : null}
          {showPoster && item && !slide ? (
            <div className={`j-poster${slow === 'breathe' ? ' breathe' : ''}`} data-testid="poster-frame">
              {item.poster ? <img src={item.poster} alt="" /> : null}
              <span className="j-poster-mark"><img src="/brand/hoopoe-mark.png" alt="" /></span>
              <span className="j-poster-who">{item.speaker}</span>
              {offline ? <p className="j-poster-note" data-testid="offline-note">{phase === 'handoff' || index === 0 ? "You're offline. Your first clip will play as soon as you're back." : "You're offline. We'll carry on from here when you're back."}</p> : null}
              {errorNote ? <p className="j-poster-note" data-testid="cannot-play">{errorNote}</p> : null}
              {slow === 'retry' && !offline ? (
                item.transcriptReady ? (
                  <a className="pill white small" href={course} data-testid="read-instead">Read it instead ›</a>
                ) : (
                  <button type="button" className="pill white small" onClick={retry} data-testid="try-again">Try again</button>
                )
              ) : null}
            </div>
          ) : null}
          {overlay && phase === 'feed' && !slide && !scenic ? <div className="j-gesture" data-testid="gesture-layer" {...swipe} /> : null}
        </div>
        {slide && item ? (
          <div className="j-slide" data-testid="gesture-layer" {...swipe}>
            <Slide item={item} style={slide} onMore={() => void stepUp()} />
          </div>
        ) : null}
        {scenic && item?.scene ? (
          <div className="j-slide" data-testid="gesture-layer" {...swipe}>
            <TeachingCard key={item.id} scene={item.scene} speaker={item.speaker} course={item.courseTitle} lane={item.laneLabel} onClip={() => void stepUp()} />
          </div>
        ) : null}
        <div className="j-chrome" data-swipe={overlay ? undefined : ''} {...(overlay ? {} : swipe)}>
          {chrome}
        </div>
      </div>

      {phase === 'handoff' && line ? <p className="j-line" data-testid="handoff-line">{line}</p> : null}

      {phase === 'opener' || phase === 'scene' || phase === 'handoff' ? (
        <div className="j-layer" data-testid="scene-layer">
          {phase === 'opener' ? (
            <Opener caption={props.opener.caption} subline={props.opener.subline} onPlay={heart?.taps.length ? resume : letsPlay} onJustShow={justShow} loginHref={loginHref} signedIn={signedIn} />
          ) : null}
          {leaving !== null && scenes[leaving] && phase === 'scene' ? (
            <div ref={leavingRef} className="j-scene-wrap leaving" aria-hidden>
              <SceneCard scene={scenes[leaving]} index={leaving} selected={null} reply={null} picked={null} onPick={() => undefined} onPass={() => undefined} onJustShow={() => undefined} />
            </div>
          ) : null}
          {(phase === 'scene' || phase === 'handoff') && scenes[sceneAt] ? (
            <div ref={sceneRef} className="j-scene-wrap" key={sceneAt}>
              <SceneCard
                scene={scenes[sceneAt]}
                index={sceneAt}
                selected={heart?.taps.find((tap) => tap.scene === scenes[sceneAt].key)?.option || null}
                reply={reply}
                picked={picked || (phase === 'handoff' ? 'x' : null)}
                onPick={pick}
                onPass={pass}
                onJustShow={justShow}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {phase === 'help' ? <HelpScreen contacts={opening.helpContacts} onBack={backToHearts} /> : null}

      {sheet ? <KeepPlaceSheet reason={sheet} loginHref={loginHref} offline={offline} onClose={closeSheet} onSubmit={signUp} /> : null}

      {notForMe && item ? (
        <div className="j-notfor" data-testid="not-for-me-menu">
          <button type="button" className="pill white" onClick={() => { signal('not-for-me'); setNotForMe(false); setToast('Got it. Fewer like this for a while.'); void advance(index + 1) }} data-testid="not-for-me">Not for me</button>
          <button type="button" className="j-escape" onClick={() => setNotForMe(false)}>Keep watching</button>
        </div>
      ) : null}

      {toast ? <div className="lane-switch" data-testid="toast"><span key={toast}>{toast}</span></div> : null}

      <div className="sr-only">
        {phase === 'feed' ? (
          <>
            <button type="button" data-testid="gesture-up" onClick={replay}>Replay this clip</button>
            <button type="button" data-testid="gesture-down" onClick={nextLane}>Switch lane</button>
            <button type="button" data-testid="gesture-left" onClick={moreLikeThis}>Next clip</button>
            <button type="button" data-testid="gesture-right" onClick={moreFromSpeaker}>More from this speaker</button>
            <button type="button" data-testid="gesture-next" onClick={() => stepLoop(1)}>Next clip on this level</button>
            <button type="button" data-testid="gesture-prev" onClick={() => stepLoop(-1)}>Previous clip on this level</button>
          </>
        ) : null}
      </div>

      {tabs && phase === 'feed' ? (
        <TabEntry
          base={base}
          unread={props.unread}
          onGuard={(event) => {
            if (signedIn) return
            const target = (event.target as HTMLElement).closest('a')
            if (target && target.getAttribute('data-testid') !== 'tab-home') {
              event.preventDefault()
              needsAccount('save')
            }
          }}
        />
      ) : null}
    </div>
  )
}

function TabEntry({ base, unread, onGuard }: { base: string; unread: number; onGuard: (event: React.MouseEvent) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    animate(ref.current, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], 300, EASE.enter, { id: 'tabbar-in' })
  }, [])
  return (
    <div ref={ref} className="j-tabs" onClickCapture={onGuard}>
      <TabBar base={`${base}`} active="home" dark unread={unread} />
    </div>
  )
}
