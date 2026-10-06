'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { FeedItem } from '@/server/learner'
import type { OpeningData } from '@/server/opening'
import { clipsFromRoute, sessionPlaylist } from '@/lib/feed-mix'
import { clipStepUpLabel, LEVEL_WORDS, onlyClipToast, pieceSeconds, poolEndToast, READY_FOR_MORE, talkStepUpLabel, withTalkDetail } from '@/lib/feed-copy'
import { appendUnseenItems, isInterstitial, learnMoreTarget, settleOnLevel, stepUpIsOwn, swipeTarget, type Swipe } from '@/lib/feed-nav'
import { applySignal, applyTap, buildFeed, decay, freshState, markServed, planFrom, routeFeed, spineStart, upgradeSpine, type FeedSlot, type HeartState, type SceneOption, type Signal } from '@/lib/heart'
import { deviceKey, haptic, readCoachDismissed, readFeedPlace, readHeart, readPending, rememberSeenCard, sessionFlags, sessionSeenCards, sessionSeenCuts, setSessionFlags, viewAsId, writeCoachDismissed, writeFeedPlace, writeHeart, writePending } from '@/lib/device'
import { EASE, T, animate, finished, reducedMotion, wait } from '@/lib/motion'
import { nextPlaybackRate } from '@/lib/playback-rate'
import { feedFilmCaption } from '@/lib/spoken-caption'
import { appetiserJoin, appetiserStop, captionIndex } from '@/lib/tiers'
import { learnMore } from '@/lib/nesting'
import { laneClips } from '@/lib/lanes'
import { isoWeek } from '@/lib/trends'
import { PLAY_NUDGE_EVERY_MS, PLAY_NUDGE_FOR_MS, hostShouldShow, planFilmAdvance, playbackAction, prepareIsCurrent, shouldNudgePlay, verticalSwipe } from '@/lib/film-advance'
import { acceptLevelTap, type LevelTap } from '@/lib/level-tap'
import { STATE, UNPLAYABLE, createPlayer, cue, destroyPlayer, getPlayer, halfVisible, hasSound, hydrateSound, lowData, pauseKeepingSound, playOnly, playerSnapshot, preloadApi, setHidden, silence, silenceHidden, silenceOthers, soundOn, type PlayerKind } from '@/lib/yt'
import { PageHelp } from '@/components/app/page-help'
import { Arch } from '@/components/arch'
import { TabBar } from '../app/shell'
import { ART as SLIDE_BACKDROP, Avatar, FollowButton, Slide } from '../app/feed'
import { HeartIcon, PlayIcon, SaveIcon, ShareIcon } from '../icons'
import { beginWith } from '@/lib/begin-with'
import { HelpScreen, Opener, SceneCard } from './scenes'
import { KeepPlaceSheet, type SheetReason } from './sheet'
import { track } from '@/lib/experiment-track'
import { useVariant, type VariantMap } from '@/lib/use-variant'
import { SpokenWords } from '../app/spoken-words'
import { sentencesFromCaptions } from '@/lib/framing/words'

type Phase = 'opener' | 'scene' | 'help' | 'handoff' | 'feed'
type Mode = 'hors' | 'appetiser'
type Spec = { key: string; videoId: string; start: number; end: number | null; kind: PlayerKind }
type Host = { spec: Spec | null; playerId: string | null; ready: boolean; state: number; played: boolean }
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
  variants?: VariantMap
  features?: import('@/lib/features').FeatureMap
}

const TAB_DELAY = 200
/** Which way the outgoing card leaves. A swipe to the left sends it left, and the next card comes in from the right. */
type Exit = 'left' | 'right' | 'up' | 'down'
const EXIT_FROM: Record<Exit, string> = { left: 'translateX(0)', right: 'translateX(0)', up: 'translateY(0)', down: 'translateY(0)' }
/** The clip's own timed line at its start, or the start itself when no line has begun. */
function harvestAt(piece: { start: number; lines?: { at: number }[] }) {
  const start = Number(piece.start) || 0
  const lines = piece.lines || []
  const showing = captionIndex(lines, start)
  const line = showing >= 0 ? lines[showing] : lines[0]
  const at = line?.at
  return typeof at === 'number' && Number.isFinite(at) ? at : start
}

const EXIT_TO: Record<Exit, string> = { left: 'translateX(-100%)', right: 'translateX(100%)', up: 'translateY(-100%)', down: 'translateY(100%)' }
const ENTER_FROM: Record<Exit, string> = { left: 'translateX(100%)', right: 'translateX(-100%)', up: 'translateY(100%)', down: 'translateY(-100%)' }
// The card leaves at the finger's pace and the next one glides in evenly; a front-loaded curve reads as a pop.
const SLIDE_OUT = 'cubic-bezier(0.4, 0, 1, 1)'
const SLIDE_IN = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
const SWIPE_EXIT: Record<Swipe, Exit> = { topic: 'left', speaker: 'right', lane: 'down', next: 'up', prev: 'down' }
/** The neighbours kept mounted beside the card, each on the side it comes in from. */
const PEEK_SWIPES = ['topic', 'speaker', 'lane', 'next'] as const satisfies readonly Swipe[]
const peekRest = (swipe: Swipe) => ENTER_FROM[SWIPE_EXIT[swipe]]
// Leaving and arriving share one curve and one duration, so the two cards move as a single strip.
const SLIDE_PAIR = 'cubic-bezier(0.32, 0.2, 0.3, 1)'
const PAIR_MS = 170
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
const decoded = new Map<string, HTMLImageElement>()
const HOLD = 700
/** A player in any other state shows YouTube's own titled thumbnail or end screen, so our poster covers it. */
const LIVE = new Set<number>([STATE.PLAYING, STATE.PAUSED, STATE.BUFFERING])

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
  const clipCta = useVariant('feed-cta-label', props.variants?.['feed-cta-label'])
  const talkCta = useVariant('full-talk-cta-label', props.variants?.['full-talk-cta-label'])
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
  const rootRef = useRef<HTMLDivElement>(null)
  const markSwipe = (on: boolean) => {
    const node = rootRef.current
    if (!node) return
    if (on) node.setAttribute('data-swiping', 'yes')
    else node.removeAttribute('data-swiping')
  }
  const [appetiserOver, setAppetiserOver] = useState(false)
  const [appetiserHeld, setAppetiserHeld] = useState(true)
  const spanJoin = useRef<number | null>(null)
  const hosts = useRef<[Host, Host]>([
    { spec: null, playerId: null, ready: false, state: -1, played: false },
    { spec: null, playerId: null, ready: false, state: -1, played: false },
  ])
  const hostEls = useRef<(HTMLDivElement | null)[]>([null, null])
  const [visibleHost, setVisibleHostState] = useState<0 | 1>(0)
  const visibleRef = useRef<0 | 1>(0)
  const [readyTick, setReadyTick] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const revealedRef = useRef(false)
  const [tabs, setTabs] = useState(props.initial === 'feed')
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
  const [coach, setCoach] = useState(false)
  const [seenCuts, setSeenCuts] = useState<number[]>([])
  const [seenCards, setSeenCards] = useState<string[]>([])
  const seenRef = useRef<Set<string>>(new Set())
  const prepareGen = useRef<[number, number]>([0, 0])
  const showGen = useRef(0)
  const advanceGen = useRef(0)
  // The clip key we mean to be playing. Cleared on a user pause and while a swipe is leaving.
  const wantPlayRef = useRef<string | null>(null)
  const userPausedRef = useRef(false)
  const nudgeRef = useRef(0)
  const playWatch = useRef(0)
  const [lineAt, setLineAt] = useState(-1)
  const [spokenAt, setSpokenAt] = useState<number | null>(null)
  const [clipPlaying, setClipPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const speedRef = useRef(1)
  const [boardOpen, setBoardOpen] = useState(false)
  const boardDrag = useRef<{ y: number; opened: boolean } | null>(null)
  const watch = useRef<{ key: string; start: number; furthest: number; done90: boolean; ended: boolean }>({ key: '', start: 0, furthest: 0, done90: false, ended: false })
  const refilling = useRef(false)
  const clipRef = useRef<HTMLDivElement>(null)
  const peekEls = useRef<Partial<Record<Swipe, HTMLDivElement | null>>>({})
  const slotRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ x: number; y: number; t: number; moved: boolean; timer: number | null } | null>(null)
  const captionDrag = useRef(false)
  const counter = useRef(0)
  const gathered = useRef(new Set<string>())
  const keepHarvestRef = useRef<() => void>(() => {})

  const setHeart = useCallback((next: HeartState) => {
    heartRef.current = next
    setHeartState(next)
    writeHeart(next)
  }, [])

  const hushHost = (at: 0 | 1) => {
    const host = hosts.current[at]
    if (host.playerId) silence(host.playerId)
  }

  const hushLeaving = () => {
    wantPlayRef.current = null
    window.clearInterval(playWatch.current)
    const hidden: 0 | 1 = visibleRef.current === 0 ? 1 : 0
    hushHost(hidden)
    hushHost(visibleRef.current)
    silenceHidden()
    silenceOthers()
    const film = typeRef.current
    if (film) {
      film.pause()
      film.muted = true
    }
  }

  const setVisibleHost = (value: 0 | 1) => {
    visibleRef.current = value
    setVisibleHostState(value)
    setHidden(hosts.current[value].playerId || '', false)
    const other: 0 | 1 = value === 0 ? 1 : 0
    setHidden(hosts.current[other].playerId || '', true)
    hushHost(other)
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
    hydrateSound()
    if (hasSound()) setMuted(false)
    seenRef.current = new Set(sessionSeenCards())
    setSeenCards(sessionSeenCards())
    setSeenCuts(sessionSeenCuts())
    if (!readCoachDismissed()) setCoach(true)
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
      return { key: `${item.cutId}:appetiser`, videoId: item.youtubeId, start: spans?.length ? spans[0].start : item.appetiser.start, end: multi ? null : appetiserEnd(item), kind: 'appetiser' }
    }
    return { key: `${item.cutId}:hors`, videoId: item.youtubeId, start: item.hors.start, end: item.hors.end, kind: 'hors' }
  }, [])

  // Ask again for several seconds after a load. playVideo in the same turn as loadVideoById
  // loses to the cue YouTube finishes afterwards, and the film sits at 0:00.
  const armPlay = useCallback((key: string) => {
    wantPlayRef.current = key
    userPausedRef.current = false
    nudgeRef.current = performance.now()
    window.clearInterval(playWatch.current)
    playWatch.current = window.setInterval(() => {
      const host = hosts.current[visibleRef.current]
      const elapsed = performance.now() - nudgeRef.current
      const player = host.playerId ? getPlayer(host.playerId) : null
      const state = player ? player.getPlayerState() : host.state
      const armed = wantPlayRef.current === key && host.spec?.key === key && Boolean(host.playerId)
      if (!shouldNudgePlay(state, armed, userPausedRef.current, elapsed)) {
        if (!armed || userPausedRef.current || state === STATE.PLAYING || elapsed >= PLAY_NUDGE_FOR_MS) window.clearInterval(playWatch.current)
        return
      }
      setHidden(host.playerId!, false)
      playOnly(host.playerId!)
    }, PLAY_NUDGE_EVERY_MS)
  }, [])

  const tryPlay = useCallback(() => {
    const host = hosts.current[visibleRef.current]
    const el = slotRef.current
    if (!host.ready || !host.playerId || !revealedRef.current || sheetRef.current) return
    if (el && !halfVisible(el)) return
    if (userPausedRef.current) return
    if (!wantPlayRef.current || wantPlayRef.current !== host.spec?.key) return
    setHidden(host.playerId, false)
    playOnly(host.playerId)
  }, [])

  const onPlayerState = useCallback((at: 0 | 1, state: number) => {
    const host = hosts.current[at]
    if (at !== visibleRef.current) {
      host.state = state
      if ((state === STATE.PLAYING || state === STATE.BUFFERING) && host.playerId) silence(host.playerId)
      return
    }
    // A PLAYING event from the clip we just left can arrive after loadVideoById and hide the poster
    // while the new film is still cued. Trust the player a frame later.
    if (state === STATE.PLAYING) {
      const id = host.playerId
      const key = host.spec?.key
      window.requestAnimationFrame(() => {
        if (visibleRef.current !== at) return
        const again = hosts.current[at]
        const player = id ? getPlayer(id) : null
        if (again.playerId !== id || again.spec?.key !== key || !player || player.getPlayerState() !== STATE.PLAYING) {
          if (wantPlayRef.current === key && id && again.playerId === id && performance.now() - nudgeRef.current > 80) {
            setHidden(id, false)
            playOnly(id)
          }
          return
        }
        const wasLive = LIVE.has(again.state)
        again.state = STATE.PLAYING
        if (!again.played || !wasLive) setReadyTick((value) => value + 1)
        again.played = true
        window.clearInterval(playWatch.current)
        setBuffering(false)
        setSlow('none')
        setErrorNote(null)
        setAppetiserHeld(false)
        player.setPlaybackRate?.(speedRef.current)
        setMuted(player.isMuted())
        if (!firstPlaying.current) {
          firstPlaying.current = true
          performance.mark('first-playing')
          window.setTimeout(() => setTabs(true), TAB_DELAY)
        }
      })
      return
    }
    const wasLive = LIVE.has(host.state)
    host.state = state
    if (wasLive !== LIVE.has(state)) setReadyTick((value) => value + 1)
    if (state === STATE.BUFFERING) {
      window.setTimeout(() => {
        if (hosts.current[visibleRef.current].state === STATE.BUFFERING) setBuffering(true)
      }, 600)
    }
    if (state === STATE.ENDED) window.dispatchEvent(new CustomEvent('hearts:ended'))
    const elapsed = performance.now() - nudgeRef.current
    if (
      shouldNudgePlay(state, wantPlayRef.current === host.spec?.key && Boolean(host.playerId), userPausedRef.current, elapsed) &&
      elapsed > 80 &&
      host.playerId
    ) {
      setHidden(host.playerId, false)
      playOnly(host.playerId)
    }
  }, [])

  const prepare = useCallback(
    async (at: 0 | 1, spec: Spec, stamp?: number) => {
      if (stamp != null && !prepareIsCurrent(stamp, showGen.current)) return
      const host = hosts.current[at]
      const el = hostEls.current[at]
      if (!el) return
      const gen = (prepareGen.current[at] += 1)
      const visible = () => at === visibleRef.current
      const current = () => stamp == null || prepareIsCurrent(stamp, showGen.current)
      const existing = host.playerId ? getPlayer(host.playerId) : null
      const action = playbackAction({ key: host.spec?.key ?? null, hasPlayer: Boolean(host.playerId && existing) }, spec.key)
      // Same iframe, already holding this clip: play it. A new id uses loadVideoById and does not
      // call playVideo in the same turn — that race finishes as CUED at 0:00.
      if (action === 'play' && host.playerId && existing) {
        host.ready = true
        if (visible() && current()) {
          const live = host.state === STATE.PLAYING || host.state === STATE.BUFFERING
          if (!live) host.played = false
          setHidden(host.playerId, false)
          armPlay(spec.key)
          playOnly(host.playerId)
        }
        setReadyTick((value) => value + 1)
        return
      }
      if (action === 'load' && host.playerId && existing?.loadVideoById) {
        if (!current()) return
        host.spec = spec
        host.played = false
        host.ready = true
        host.state = STATE.UNSTARTED
        if (!visible()) {
          cue(host.playerId, existing, spec.videoId, spec.start, spec.end)
          silence(host.playerId)
        } else {
          if (hasSound()) existing.unMute()
          else existing.mute()
          armPlay(spec.key)
          existing.loadVideoById({ videoId: spec.videoId, startSeconds: spec.start, ...(spec.end ? { endSeconds: spec.end } : {}) })
        }
        setReadyTick((value) => value + 1)
        return
      }
      if (!current()) return
      if (host.playerId) {
        silence(host.playerId)
        destroyPlayer(host.playerId)
      }
      counter.current += 1
      const id = `h${at}-${counter.current}`
      host.spec = spec
      host.playerId = id
      host.ready = false
      host.played = false
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
            if (!current() || prepareGen.current[at] !== gen || host.playerId !== id) {
              try {
                player.mute()
                player.pauseVideo()
                player.destroy()
              } catch {
                // A newer prepare owns this host.
              }
              return
            }
            if (!visible() || !revealedRef.current) {
              player.mute()
              cue(id, player, spec.videoId, spec.start, spec.end)
            }
            host.ready = true
            setReadyTick((value) => value + 1)
            if (visible()) {
              setHidden(id, false)
              armPlay(spec.key)
              tryPlay()
            } else silence(id)
          },
          onState: (state) => host.playerId === id && onPlayerState(at, state),
          onError: (code) => host.playerId === id && window.dispatchEvent(new CustomEvent('hearts:player-error', { detail: { code, at } })),
        })
        if (prepareGen.current[at] !== gen && host.playerId === id) {
          silence(id)
          destroyPlayer(id)
          host.playerId = null
        }
      } catch {
        if (host.playerId === id) {
          setSlow('retry')
          keepHarvestRef.current()
        }
      }
    },
    [armPlay, onPlayerState, tryPlay],
  )

  const stopVisible = () => {
    const host = hosts.current[visibleRef.current]
    if (host.playerId) silence(host.playerId)
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

  /** Shows item `at` in the slot, on the iframe that already earned muted autoplay. */
  const showItem = useCallback(
    async (at: number, kind: Mode = 'hors', onShown?: () => Promise<void>) => {
      const item = itemsRef.current[at]
      const ticket = (showGen.current += 1)
      if (clipRef.current) {
        clipRef.current.getAnimations().forEach((animation) => animation.cancel())
        clipRef.current.style.transform = ''
      }
      indexRef.current = at
      modeRef.current = kind
      setIndex(at)
      setMode(kind)
      setErrorNote(null)
      setSlow('none')
      setBuffering(false)
      setLineAt(-1)
      setSpokenAt(null)
      setAppetiserOver(false)
      if (item) {
        const seen = rememberSeenCard(item.cutId, item.card || 'talk', kind)
        seenRef.current = new Set(seen.cards)
        setSeenCards(seen.cards)
        setSeenCuts(seen.cuts)
      }
      writeFeedPlace(item ? { cutId: item.cutId, mode: kind, card: item.card || 'talk' } : null)
      watch.current = { key: `${item?.cutId}:${kind}:${item?.card || 'talk'}`, start: kind === 'hors' ? item?.hors.start || 0 : item?.appetiser.start || 0, furthest: 0, done90: false, ended: false }
      // The new card is on screen (and sliding in) before any player work starts.
      if (onShown) await onShown()
      const spec = specFor(item, kind)
      if (!spec) {
        hushLeaving()
        stopVisible()
        return
      }
      const current = visibleRef.current
      const hold = (at: 0 | 1) => {
        const row = hosts.current[at]
        return { key: row.spec?.key ?? null, hasPlayer: Boolean(row.playerId && getPlayer(row.playerId)) }
      }
      // Keep the warmed iframe. Revealing the preloaded hidden one leaves the film cued at 0:00.
      const target = planFilmAdvance(current, spec.key, [hold(0), hold(1)]).target
      if (target !== current) {
        hushHost(current)
        stopVisible()
      }
      setVisibleHost(target)
      hushHost(target === 0 ? 1 : 0)
      if (!prepareIsCurrent(ticket, showGen.current)) return
      await prepare(target, spec, ticket)
      if (!prepareIsCurrent(ticket, showGen.current)) return
      tryPlay()
      if (kind === 'hors') preloadNext(at)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prepare, preloadNext, specFor, tryPlay],
  )

  useEffect(() => {
    tryPlay()
  }, [readyTick, revealed, tryPlay])

  useEffect(() => () => window.clearInterval(playWatch.current), [])

  // ---------- feed data ----------
  // The feed is routed here on the device from the bundled clip map: lane scores, the lead lane and served clips
  // never leave it (P1 and P2).
  const fetchFeed = useCallback(
    async (state: HeartState, justShow = false) => {
      const local = { ...ctx, now: Date.now() }
      let route: { items: FeedSlot[]; spinePointer: number } = routeFeed(state, local, { justShow })
      // Once the learner has seen everything, start the spine again rather than leave the feed empty.
      if (!route.items.length) route = buildFeed({ ...planFrom(state, local, { justShow }), served: [], spinePointer: 0 }, local)
      const clips = clipsFromRoute(route.items, opening.clips, opening.laneTitles)
      return { items: route.items, clips, spinePointer: route.spinePointer }
    },
    [ctx, opening.clips, opening.laneTitles],
  )

  const adopt = useCallback(
    (clips: FeedItem[], slots: FeedSlot[], spinePointer: number, replace: boolean) => {
      const merged = (replace ? clips : appendUnseenItems(itemsRef.current, clips)).filter((row) => !isInterstitial(row))
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
      const visit = heartRef.current?.served.length || 0
      const mixed = sessionPlaylist(data.clips, opening.clips, visit, backgroundsBase)
      adopt(mixed, data.items, data.spinePointer, false)
    } catch {
      // Offline: carry on with what is here.
    } finally {
      refilling.current = false
    }
  }, [adopt, backgroundsBase, fetchFeed, opening.clips])

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
        clips = sessionPlaylist(clips, opening.clips, state.served.length, backgroundsBase)
        const stored = !props.clip && !props.lane ? readFeedPlace() : null
        const saved = stored?.cutId ? opening.clips[String(stored.cutId)] : undefined
        if (saved && !clips.some((row) => row.cutId === saved.cutId)) clips = [{ ...saved, laneKey: null }, ...clips]
        adopt(clips, data.items, data.spinePointer, true)
        const resumeAt = stored ? clips.findIndex((row) => row.cutId === stored.cutId && (!row.card || row.card === 'talk')) : -1
        const startAt = resumeAt >= 0 ? resumeAt : 0
        const startMode = resumeAt >= 0 && stored?.mode === 'appetiser' ? 'appetiser' : firstMode
        const activation = typeof navigator !== 'undefined' && Boolean(navigator.userActivation?.isActive || navigator.userActivation?.hasBeenActive)
        if (activation || hasSound()) {
          soundOn(hosts.current[visibleRef.current].playerId || '')
          setMuted(false)
        }
        await showItem(startAt, startMode)
        if (signedIn) setTabs(true)
        else window.setTimeout(() => setTabs(true), 1200)
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

  // Captions wait on lineAt. Harvest does not: keep a line when the clip ends, errors or is swiped.
  const keepHarvest = useCallback(() => {
    if (!signedIn || props.viewAs) return
    const current = itemsRef.current[indexRef.current]
    const level = modeRef.current
    if (!current?.lessonId || (level !== 'hors' && level !== 'appetiser')) return
    const piece = level === 'hors' ? current.hors : current.appetiser
    const seconds = harvestAt(piece)
    if (!Number.isFinite(seconds)) return
    const key = `${current.lessonId}:${level}:${Math.round(seconds)}`
    if (gathered.current.has(key)) return
    gathered.current.add(key)
    void fetch('/api/hearts/harvest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lessonId: current.lessonId, seconds, surface: level }),
    }).then((response) => {
      if (!response.ok) gathered.current.delete(key)
    }).catch(() => {
      gathered.current.delete(key)
    })
  }, [signedIn, props.viewAs])
  keepHarvestRef.current = keepHarvest

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
  const lastLevelTap = useRef<LevelTap | null>(null)
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
      soundOn(hosts.current[visibleRef.current].playerId || '')
      setMuted(false)
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
      if (props.signedIn && props.learner && !props.viewAs) {
        try {
          await fetch(`/api/workbook/opening?portal=${opening.portal}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ scenesVersion: state.scenesVersion, taps: state.taps.map((tap) => ({ sceneKey: tap.scene, optionKey: tap.option, answeredAt: tap.at })) }),
          })
          setHeart({ ...handed, synced: true } as HeartState)
        } catch {
          // Feed still opens. Home treats visits and saved taps as enough to stay in the app.
        }
      }
      if (starter) {
        itemsRef.current = [starter]
        setItems([starter])
      }
      setFirstEver(true)
      const topic = beginWith(state, opening.scenes)
      setLine(justShow ? props.opener.justShow : `We'll begin with ${topic.title}.`)
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
      watch.current = { key: `${starter?.cutId}:hors`, start: starter?.hors.start || 0, furthest: 0, done90: false, ended: false }
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
        const seeded = data.clips.length ? data.clips : itemsRef.current
        const mixed = sessionPlaylist(seeded, opening.clips, state.served.length, backgroundsBase)
        adopt(mixed.length ? mixed : itemsRef.current, data.items, data.spinePointer, true)
        if (!starter && mixed[0]) await showItem(0)
        else preloadNext(0)
      }
      setTabs(true)
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
      soundOn(hosts.current[visibleRef.current].playerId || '')
      setMuted(false)
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
    void fetch('/api/hearts', { method: 'POST', headers: { accept: 'application/json' }, body: form, keepalive: true }).catch(() => undefined)
    const seconds = Math.max(0, Math.round(piece.end - piece.start))
    if (event === 'linger' && level === 'hors') {
      track('clip_watch_seconds', { seconds, lesson: current.lessonId })
      track('clip_watch_completion', { lesson: current.lessonId })
    }
    if (event === 'linger' && level === 'appetiser') {
      track('clip_watch_seconds', { seconds, lesson: current.lessonId, level: 'appetiser' })
      track('appetiser_complete', { lesson: current.lessonId })
    }
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

  const dismissCoach = () => {
    if (!coach && readCoachDismissed()) return
    setCoach(false)
    writeCoachDismissed()
  }

  const advance = useCallback(
    async (to: number, how: 'swipe' | 'auto' = 'swipe', exit: Exit = 'up', via?: Swipe) => {
      const ticket = (advanceGen.current += 1)
      keepHarvest()
      const list = itemsRef.current
      if (!list.length) return
      hushLeaving()
      if (how === 'swipe') {
        setCoach(false)
        writeCoachDismissed()
      }
      // Whatever moves the feed, it stays on the level being watched.
      const target = settleOnLevel(list, to, modeRef.current, to < indexRef.current ? -1 : 1)
      if (target === null) return
      // Drop any show already in flight so its prepare cannot load the clip we are leaving.
      showGen.current += 1
      if (how === 'swipe') leaveSignal()
      const el = clipRef.current
      // A second Next during the slide used to leave the card translated off the phone: a blank
      // field with nothing but the controls. Only the latest step may move the film.
      if (el) {
        el.getAnimations().forEach((animation) => animation.cancel())
        el.style.transform = ''
      }
      for (const side of ['topic', 'speaker', 'lane', 'next'] as const) {
        const parked = peekEls.current[side]
        if (parked) parked.style.transform = peekRest(side)
      }
      if (advanceGen.current !== ticket) return
      const peek = how === 'swipe' && via ? peekEls.current[via] : null
      // The neighbour already mounted beside the card is the incoming side, so it is never bare.
      const incoming = peek && Number(peek.dataset.index) === target && !reducedMotion() ? peek : null
      if (how === 'swipe' && el) {
        // Carry on from wherever the finger left the card, so the move never jumps.
        const from = el.style.transform || EXIT_FROM[exit]
        el.style.transform = ''
        markSwipe(true)
        const out = animate(el, [{ transform: from }, { transform: EXIT_TO[exit] }], incoming ? PAIR_MS : 160, incoming ? SLIDE_PAIR : SLIDE_OUT, { id: 'snap' })
        if (incoming) {
          const peekFrom = incoming.style.transform || ENTER_FROM[exit]
          incoming.style.transform = ENTER_FROM[exit]
          animate(incoming, [{ transform: peekFrom }, { transform: 'translate(0, 0)' }], PAIR_MS, SLIDE_PAIR, { id: 'peek-in' })
        }
        await finished(out)
      }
      if (advanceGen.current !== ticket) return
      setFirstEver(false)
      // A swipe moves along the level being watched; only "Learn more" goes up a level.
      await showItem(target, modeRef.current, async () => {
        if (!el) return
        await nextFrame()
        if (incoming) {
          // The card returns to the middle only once it holds the new item; the neighbour then goes back to its side.
          await nextFrame()
          el.getAnimations().forEach((animation) => animation.cancel())
          incoming.getAnimations().forEach((animation) => animation.cancel())
          return
        }
        // The poster is on screen at once; the incoming card slides in from the side opposite the exit.
        el.getAnimations().forEach((animation) => animation.cancel())
        if (how === 'swipe') animate(el, [{ transform: ENTER_FROM[exit] }, { transform: 'translate(0, 0)' }], 220, SLIDE_IN, { id: 'enter', fill: 'none' })
      })
      if (advanceGen.current !== ticket) return
      markSwipe(false)
      void refill()
    },
    [keepHarvest, leaveSignal, refill, showItem],
  )

  useEffect(() => {
    const onEnded = () => {
      keepHarvest()
      if (modeRef.current !== 'hors') return
      const flagsNow = sessionFlags()
      if (!signedIn && !flagsNow.firstEnded) {
        setSessionFlags({ ...sessionFlags(), firstEnded: true })
        if (openSheet('ended')) {
          pendingAfterSheet.current = 'next'
          return
        }
      }
      const next = swipeTarget(itemsRef.current, indexRef.current, modeRef.current, 'next', seenRef.current)
      if (next == null) setToast(poolEndToast())
      else void advance(next, 'auto')
    }
    const onError = (event: Event) => {
      const { code, at } = (event as CustomEvent<{ code: number; at: number }>).detail
      if (at !== visibleRef.current || !UNPLAYABLE.has(code)) return
      keepHarvest()
      const current = itemsRef.current[indexRef.current]
      setErrorNote("This one can't play here")
      if (current && signedIn) void fetch('/api/hearts/unplayable', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cutId: current.cutId, code }) }).catch(() => undefined)
      window.setTimeout(() => {
        const next = swipeTarget(itemsRef.current, indexRef.current, modeRef.current, 'next', seenRef.current)
        if (next == null) setToast(poolEndToast())
        else void advance(next, 'auto')
      }, 900)
    }
    window.addEventListener('hearts:ended', onEnded)
    window.addEventListener('hearts:player-error', onError)
    return () => {
      window.removeEventListener('hearts:ended', onEnded)
      window.removeEventListener('hearts:player-error', onError)
    }
  }, [advance, keepHarvest, openSheet, signedIn])

  const pendingAfterSheet = useRef<'next' | null>(null)
  const closeSheet = () => {
    sheetRef.current = null
    setSheet(null)
    if (window.history.state?.hearts?.sheet) window.history.back()
    if (pendingAfterSheet.current === 'next') {
      pendingAfterSheet.current = null
      const next = swipeTarget(itemsRef.current, indexRef.current, modeRef.current, 'next', seenRef.current)
      if (next == null) setToast(poolEndToast())
      else void advance(next, 'auto')
    } else window.setTimeout(() => tryPlay(), 0)
  }

  // Poll while playing: how far the learner got, the 90% mark, and any hidden host that started talking.
  useEffect(() => {
    if (phase !== 'feed') return
    const timer = window.setInterval(() => {
      silenceHidden()
      const hiddenAt: 0 | 1 = visibleRef.current === 0 ? 1 : 0
      const hidden = hosts.current[hiddenAt]
      if (hidden.playerId) {
        const other = getPlayer(hidden.playerId)
        const otherState = other?.getPlayerState()
        if (other && (otherState === STATE.PLAYING || otherState === STATE.BUFFERING || !other.isMuted())) silence(hidden.playerId)
      }
      const host = hosts.current[visibleRef.current]
      const player = host.playerId ? getPlayer(host.playerId) : null
      const realState = player ? player.getPlayerState() : host.state
      if (realState !== STATE.PLAYING || !player) return
      const current = itemsRef.current[indexRef.current]
      if (!current) return
      const time = player.getCurrentTime()
      setClipPlaying(host.state === STATE.PLAYING)
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
          player.mute()
          player.pauseVideo()
          player.seekTo(spans[spans.length - 1].end, true)
          setAppetiserOver(true)
          if (!seen.done90) {
            seen.done90 = true
            noteBrowse('linger')
          }
          return
        }
      } else if (modeRef.current === 'appetiser' && time >= appetiserEnd(current) - 0.25) {
        player.mute()
        player.pauseVideo()
        player.seekTo(appetiserEnd(current), true)
        setAppetiserOver(true)
        if (!seen.done90) {
          seen.done90 = true
          noteBrowse('linger')
        }
        return
      }
      // The player's own end mark is a whole second; the clip stops at its real out point, between sentences.
      if (modeRef.current === 'hors' && (!current.card || current.card === 'talk') && current.hors.end > current.hors.start && time >= current.hors.end) {
        player.mute()
        player.pauseVideo()
        if (!seen.done90) {
          seen.done90 = true
          signal('watched90')
          noteBrowse('linger')
        }
        if (!seen.ended) {
          seen.ended = true
          window.dispatchEvent(new CustomEvent('hearts:ended'))
        }
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
      const start = modeRef.current === 'hors' ? current.hors.start : current.appetiser.start
      const end = modeRef.current === 'hors' ? current.hors.end : appetiserEnd(current)
      const span = Math.max(0.5, end - start)
      const watchPct = Math.max(0, Math.min(100, Math.round(((time - start) / span) * 100)))
      const last = (seen as { lastInsightPct?: number }).lastInsightPct || 0
      if (watchPct >= last + 8 || watchPct >= 90) {
        ;(seen as { lastInsightPct?: number }).lastInsightPct = watchPct
        try {
          window.dispatchEvent(new CustomEvent('hearts-insight', { detail: { kind: 'clip_watch', clipId: String(current.cutId || current.id || ''), watchPct, lane: current.laneKey } }))
        } catch {
          // ignore
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
    const host = hosts.current[visibleRef.current]
    userPausedRef.current = false
    if (host.spec) armPlay(host.spec.key)
    if (host.playerId && host.spec && host === hosts.current[visibleRef.current]) {
      const player = getPlayer(host.playerId)
      player?.pauseVideo()
      player?.seekTo(host.spec.start, true)
      tryPlay()
    } else void showItem(indexRef.current, modeRef.current)
    setToast('Playing this clip again.')
  }
  const swipeTo = (swipe: Swipe) => {
    const current = itemsRef.current[indexRef.current]
    if (!current) return
    hushLeaving()
    dismissCoach()
    let list = itemsRef.current
    let target = swipeTarget(list, indexRef.current, modeRef.current, swipe, seenRef.current)
    if (target === null) {
      const wider = sessionPlaylist(list, opening.clips, heartRef.current?.served.length || 0, backgroundsBase)
      if (wider.length > list.length) {
        itemsRef.current = wider
        setItems(wider)
        list = wider
        target = swipeTarget(list, indexRef.current, modeRef.current, swipe, seenRef.current)
      }
    }
    if (target === null) {
      markSwipe(false)
      springBack()
      if (swipe === 'speaker') return setToast(`That's everything from ${current.speaker} for now.`)
      if (swipe === 'topic') return setToast("That's everything on this topic for now.")
      return setToast(itemsRef.current.length < 2 ? onlyClipToast(modeRef.current) : poolEndToast())
    }
    const laneLabel = list[target]?.laneLabel?.trim()
    if (swipe === 'lane' && laneLabel) setToast(`Lane · ${laneLabel}`)
    if (swipe === 'topic' && list[target]?.lane === current.lane) setToast('More on this topic.')
    if (swipe === 'speaker' && list[target]?.speaker === current.speaker) setToast(`More from ${current.speaker}.`)
    try {
      const host = hosts.current[visibleRef.current]
      const player = host.playerId ? getPlayer(host.playerId) : null
      const time = player?.getCurrentTime?.() ?? current.hors.start
      const start = modeRef.current === 'hors' ? current.hors.start : current.appetiser.start
      const end = modeRef.current === 'hors' ? current.hors.end : appetiserEnd(current)
      const span = Math.max(0.5, end - start)
      const watchPct = Math.max(0, Math.min(100, Math.round(((time - start) / span) * 100)))
      window.dispatchEvent(new CustomEvent('hearts-insight', { detail: { kind: 'clip_swipe', clipId: String(current.cutId || current.id || ''), watchPct, lane: current.laneKey } }))
      window.dispatchEvent(new CustomEvent('hearts-insight', { detail: { kind: 'route', route: window.location.pathname, lane: list[target]?.laneKey } }))
    } catch {
      // ignore
    }
    void advance(target, 'swipe', SWIPE_EXIT[swipe], swipe)
  }
  const nextLane = () => swipeTo('lane')
  const moreLikeThis = () => swipeTo('topic')
  const moreFromSpeaker = () => swipeTo('speaker')
  const stepLoop = (direction: 1 | -1) => swipeTo(direction === 1 ? 'next' : 'prev')
  const stepLoopRef = useRef(stepLoop)
  stepLoopRef.current = stepLoop
  const nextLaneRef = useRef(nextLane)
  nextLaneRef.current = nextLane

  // Wheel and arrow keys step the hors d'oeuvre order. A real click, wheel or key must not depend on the
  // YouTube iframe having focus: that frame swallows them, and the feed then looks stuck on one clip.
  useEffect(() => {
    if (phase !== 'feed') return
    let wheelLock = 0
    const typing = (event: Event) => Boolean((event.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]'))
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || sheetRef.current || typing(event)) return
      const next = event.key === 'ArrowDown' || event.key === 'PageDown'
      const prev = event.key === 'ArrowUp' || event.key === 'PageUp'
      if (!next && !prev) return
      event.preventDefault()
      stepLoopRef.current(next ? 1 : -1)
    }
    const onWheel = (event: WheelEvent) => {
      if (sheetRef.current || typing(event)) return
      if ((event.target as HTMLElement | null)?.closest?.('.j-sheet, .caption[data-expanded="true"]')) return
      if (Math.abs(event.deltaY) < 24 || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return
      event.preventDefault()
      const now = performance.now()
      if (now < wheelLock) return
      wheelLock = now + 420
      stepLoopRef.current(event.deltaY > 0 ? 1 : -1)
    }
    // If the YouTube iframe still receives the pointer, finish the swipe here. The gesture layer
    // handles its own events, so this only runs when the target is that iframe.
    let drag: { x: number; y: number; pointerId: number } | null = null
    const iframeInSlot = (event: Event) => {
      const node = event.target as HTMLElement | null
      return node?.tagName === 'IFRAME' && Boolean(node.closest?.('.j-slot'))
    }
    const onPointerDown = (event: PointerEvent) => {
      if (sheetRef.current || !iframeInSlot(event)) return
      drag = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }
    }
    const onPointerUp = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return
      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y
      drag = null
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 48 || Math.abs(dy) <= Math.abs(dx)) return
      if (verticalSwipe(dy) === 'next') stepLoopRef.current(1)
      else nextLaneRef.current()
    }
    const onPointerCancel = () => {
      drag = null
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('pointerup', onPointerUp, true)
    window.addEventListener('pointercancel', onPointerCancel, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('pointerup', onPointerUp, true)
      window.removeEventListener('pointercancel', onPointerCancel, true)
    }
  }, [phase])

  const stepUp = async (event?: React.MouseEvent<HTMLAnchorElement>) => {
    const current = itemsRef.current[indexRef.current]
    if (!current) return
    const step = learnMoreTarget(itemsRef.current, indexRef.current, modeRef.current, base)
    if (!step) return
    const own = itemsRef.current[step.level === 'appetiser' ? step.index : indexRef.current]
    if (step.level === 'appetiser' && !stepUpIsOwn(current, own)) {
      const fallback = itemsRef.current.findIndex((row) => row.cutId === current.cutId && row.lessonId === current.lessonId && !isInterstitial(row))
      hushLeaving()
      setAppetiserHeld(false)
      soundOn(hosts.current[visibleRef.current].playerId || '')
      noteBrowse('learn-more')
      void showItem(fallback >= 0 ? fallback : indexRef.current, 'appetiser')
      return
    }
    if (step.level === 'appetiser') {
      signal('watch-full')
      hushLeaving()
      setAppetiserHeld(false)
      // The tap is the gesture that turns voice on. Reuse the same player so play stays in this tap.
      soundOn(hosts.current[visibleRef.current].playerId || '')
      noteBrowse('learn-more')
      track('clip_cta_tap', { level: 'hors', lesson: current.lessonId })
      const url = new URL(window.location.href)
      url.searchParams.set('clip', String(current.cutId))
      url.searchParams.set('play', 'appetiser')
      push(`${url.pathname}${url.search}`, { appetiser: current.cutId })
      void showItem(step.index, 'appetiser')
      return
    }
    event?.preventDefault()
    if (needsAccount('save')) return
    if (step.lessonId !== current.lessonId) return
    signal('start-course')
    noteBrowse('learn-more')
    track('clip_cta_tap', { level: 'appetiser', lesson: current.lessonId })
    track('full_talk_start', { lesson: current.lessonId })
    haptic(10)
    hushLeaving()
    stopVisible()
    const node = event?.currentTarget
    if (node) await finished(animate(node, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.6)', opacity: 0 }], 500, EASE.enter, { id: 'mains-transform' }))
    router.push(step.href)
  }

  const takeLevel = (intent: LevelTap['intent']) => {
    const tap = { intent, at: performance.now() }
    if (!acceptLevelTap(lastLevelTap.current, tap)) return false
    lastLevelTap.current = tap
    return true
  }

  const requestClip = () => {
    if (!takeLevel('hors') || modeRef.current === 'hors') return
    void showItem(indexRef.current, 'hors')
  }

  const requestExtract = () => {
    if (!takeLevel('appetiser') || modeRef.current === 'appetiser') return
    void stepUp()
  }

  const requestTalk = () => {
    if (!takeLevel('talk')) return
    watchFull()
  }

  const watchFull = () => {
    const current = itemsRef.current[indexRef.current]
    if (!current) return
    if (needsAccount('save')) return
    const href = learnMore(current, 'appetiser', base)?.href
    if (!href) return
    signal('start-course')
    noteBrowse('learn-more')
    track('full_talk_start', { lesson: current.lessonId })
    haptic(10)
    hushLeaving()
    stopVisible()
    router.push(href)
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
    setAppetiserHeld(false)
    const host = hosts.current[visibleRef.current]
    setSessionFlags({ ...sessionFlags(), unmuted: true })
    if (host.playerId) {
      soundOn(host.playerId)
      const player = getPlayer(host.playerId)
      player?.unMute()
      player?.playVideo()
    }
    if (typeRef.current) {
      typeRef.current.muted = false
      void typeRef.current.play().catch(() => undefined)
    }
    setMuted(false)
  }

  const tapPicture = () => {
    const host = hosts.current[visibleRef.current]
    const player = host.playerId ? getPlayer(host.playerId) : null
    const real = player?.getPlayerState()
    // Pause only pauses. It must not mute, or the next play comes back silent.
    if (player && (real === STATE.PLAYING || real === STATE.BUFFERING)) {
      userPausedRef.current = true
      wantPlayRef.current = null
      const heard = hasSound() || !player.isMuted()
      pauseKeepingSound(player, heard)
      return
    }
    if (!hasSound()) {
      tapSound()
      return
    }
    if (player) {
      userPausedRef.current = false
      if (host.spec) armPlay(host.spec.key)
      player.unMute()
      player.playVideo()
      return
    }
    tryPlay()
  }

  const pauseForSwipe = () => {
    const host = hosts.current[visibleRef.current]
    if (host.playerId) getPlayer(host.playerId)?.pauseVideo()
  }

  const resumeAfterSwipe = () => {
    if (userPausedRef.current) return
    const host = hosts.current[visibleRef.current]
    const player = host.playerId ? getPlayer(host.playerId) : null
    if (!player || !host.spec) return
    if (hasSound()) player.unMute()
    armPlay(host.spec.key)
    player.playVideo()
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
    const store = window as Window & { __HEARTS_FEED_SNAP?: () => ReturnType<typeof playerSnapshot> }
    store.__HEARTS_FEED_SNAP = () => playerSnapshot()
    return () => {
      delete store.__HEARTS_FEED_SNAP
    }
  }, [])

  const peeks = useMemo(() => {
    if (phase !== 'feed' || items.length < 2) return []
    const out: { swipe: Swipe; at: number }[] = []
    for (const swipe of PEEK_SWIPES) {
      const raw = swipeTarget(items, index, mode, swipe, seenRef.current)
      if (raw === null) continue
      const at = settleOnLevel(items, raw, mode, raw < index ? -1 : 1)
      if (at !== null && at !== index) out.push({ swipe, at })
    }
    return out
  }, [phase, items, index, mode])

  useEffect(() => {
    for (const { at } of peeks) {
      const src = stillOf(items[at], mode)
      if (!src || decoded.has(src)) continue
      const image = new Image()
      image.src = src
      decoded.set(src, image)
      void image.decode?.().catch(() => decoded.delete(src))
    }
  }, [peeks, items, mode])

  // Gestures on the clip. In overlay mode the gesture layer covers the player; in strict mode only the chrome.
  const onDown = (event: ReactPointerEvent) => {
    if (boardOpen) return
    if ((event.target as HTMLElement).closest('[data-testid="feed-board"], [data-testid="more-board"], [data-testid="board-back"]')) return
    if (!(event.target as HTMLElement).closest('button, a, input, textarea, select, label')) (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
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
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 8 && !start.moved) {
      start.moved = true
      pauseForSwipe()
      markSwipe(true)
    }
    if (!clipRef.current || !start.moved) return
    const vertical = Math.abs(dy) > Math.abs(dx)
    if (vertical) {
      clipRef.current.style.transform = `translateY(${dy}px)`
      const down = dy > 0
      const peek = down ? peekEls.current.lane : peekEls.current.next
      if (peek) peek.style.transform = down ? `translateY(calc(-100% + ${dy}px))` : `translateY(calc(100% + ${dy}px))`
      return
    }
    clipRef.current.style.transform = `translateX(${dx}px)`
    const topic = peekEls.current.topic
    const speaker = peekEls.current.speaker
    if (topic) topic.style.transform = `translateX(calc(100% + ${dx}px))`
    if (speaker) speaker.style.transform = `translateX(calc(-100% + ${dx}px))`
  }
  const onUp = (event: ReactPointerEvent) => {
    const start = gesture.current
    gesture.current = null
    if (!start) return
    if (start.timer) window.clearTimeout(start.timer)
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    const elapsed = Math.max(1, performance.now() - start.t)
    const width = clipRef.current?.clientWidth || 390
    const height = clipRef.current?.clientHeight || 700
    const far = Math.max(Math.abs(dx), Math.abs(dy))
    const vertical = Math.abs(dy) > Math.abs(dx)
    const quick = far / elapsed >= 0.35
    // A downward swipe used to be judged against the screen width, so an ordinary swipe down never landed.
    const commit = vertical ? far >= 48 || (far >= 32 && quick) : far >= 40 && (far >= width * 0.25 || quick || far >= height * 0.12)
    if (!commit) {
      markSwipe(false)
      springBack()
      if (start.moved) resumeAfterSwipe()
      else if (!slide && cardKind !== 'question' && cardKind !== 'text') tapPicture()
      return
    }
    if (vertical) {
      if (verticalSwipe(dy) === 'next') stepLoop(1)
      else nextLane()
    } else if (dx < 0) moreLikeThis()
    else moreFromSpeaker()
  }
  const onCancel = () => {
    const start = gesture.current
    gesture.current = null
    if (start?.timer) window.clearTimeout(start.timer)
    markSwipe(false)
    springBack()
    if (start?.moved) resumeAfterSwipe()
  }
  const springBack = () => {
    const el = clipRef.current
    for (const side of ['topic', 'speaker', 'lane', 'next'] as const) {
      const peek = peekEls.current[side]
      if (!peek || !peek.style.transform.includes('calc')) continue
      const from = peek.style.transform
      peek.style.transform = peekRest(side)
      animate(peek, [{ transform: from }, { transform: peekRest(side) }], T.sheet, EASE.calm, { id: 'peek-back', fill: 'none' })
    }
    if (!el || !el.style.transform) return
    const from = el.style.transform
    el.style.transform = ''
    animate(el, [{ transform: from }, { transform: 'translate(0, 0)' }], T.sheet, EASE.calm, { id: 'spring-back', fill: 'none' })
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
  // Face films, scenic typing cards, and question or text cards are not part of the learner feed.
  const cardKind = null
  const typeSrc = item?.typography?.src
  const typeClip = Boolean(phase === 'feed' && mode === 'hors' && typeSrc && !isInterstitial(item))
  const scenic = false
  const feedCard = false
  const started = playerReady && host.played && LIVE.has(host.state)
  const playingOut = playerReady && host.played && host.state === STATE.PLAYING
  const keepAppetiserPoster = mode === 'appetiser' && appetiserHeld && host.state !== STATE.PLAYING
  const showPoster = !typeClip && !scenic && (phase === 'handoff' || (phase === 'feed' && (keepAppetiserPoster || !playingOut || Boolean(errorNote) || offline)))
  const waitingToPlay = phase === 'feed' && playerReady && (keepAppetiserPoster || !playingOut) && !errorNote && !offline
  // The gold play control is a resume after a pause, or a way in when autoplay never starts.
  // It is not a gate on the way into a clip.
  const showPlayControl = waitingToPlay && slow === 'retry'
  const piece = item ? (mode === 'hors' ? item.hors : item.appetiser) : null
  const lineShown = mode === 'hors' && lineAt >= 0 ? lineAt : -1
  const horsLine = lineShown >= 0 ? piece?.lines?.[lineShown] : null
  const wordsInPicture = Boolean(item?.wordsInPicture || item?.vertical)
  const captionText = feedFilmCaption(
    horsLine,
    piece?.lines,
    [item?.lessonTitle, item?.courseTitle],
    [item?.hook, item?.hookTidy, item?.turn, item?.turnTidy, item?.land, item?.landTidy, item?.hors.quote],
    item?.hors.end,
  )
  const videoAppetiser = mode === 'appetiser' && Boolean(item?.youtubeId)
  const scenicAppetiser = mode === 'appetiser' && !item?.youtubeId
  const scenicLines = scenicAppetiser ? [item?.scenic?.hook, item?.scenic?.turn, item?.scenic?.land].filter((line): line is string => Boolean(line)) : []
  useEffect(() => {
    setCaptionOpen(false)
    setAppetiserHeld(true)
    setBoardOpen(false)
  }, [item?.id])
  const slide = null
  const course = (item && learnMore(item, 'appetiser', base)?.href) || base
  const horsParent = item?.parents?.hors
  const appetiserParent = item?.parents?.appetiser
  const captionButton = item && captionText ? (
    <button
      type="button"
      className={`caption j-caption-plate${captionText.length > 120 ? ' long' : ''}${wordsInPicture ? ' j-caption-clear' : ''}`}
      data-testid="caption"
      data-slot={wordsInPicture ? 'bar' : 'over'}
      data-at={horsLine ? String(horsLine.at) : ''}
      data-line={lineShown}
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
      {captionText}
    </button>
  ) : null
  const laneVisible = Boolean(item) && !firstEver
  void readyTick

  // A Short (or a film with burned-in words) has text in the picture: the speaker sits at the top, and our caption sits in the bar below the 16:9 band.
  const speakerRow = item ? (
    <div className="j-speaker j-speaker-plate">
      <a className="speaker-row" href={`${base}/speaker/${item.speakerSlug}`} data-testid="speaker-link" onClick={(event) => { if (needsAccount('save')) event.preventDefault() }}>
        <Avatar name={item.speaker} portrait={item.portrait} />
        <span className="who"><b>{item.speaker}</b>{laneVisible && item.laneLabel ? <small>On {item.laneLabel}</small> : null}</span>
      </a>
      <span onClickCapture={(event) => { if (needsAccount('save')) { event.preventDefault(); event.stopPropagation() } }}><FollowButton slug={item.speakerSlug} /></span>
    </div>
  ) : null

  const clipStart = item ? (mode === 'hors' ? item.hors.start : item.appetiser.start) : 0
  const clipEnd = item ? (mode === 'hors' ? item.hors.end : appetiserEnd(item)) : 0
  const clipLength = Math.max(0, clipEnd - clipStart)
  const clipElapsed = spokenAt != null ? Math.max(0, Math.min(clipLength, spokenAt - clipStart)) : 0
  const clipLeft = Math.max(0, clipLength - clipElapsed)
  const clipPct = clipLength ? Math.min(100, (clipElapsed / clipLength) * 100) : 0
  const spokenSentences = item?.framingTrack?.sentences?.length
    ? item.framingTrack.sentences
    : sentencesFromCaptions(mode === 'hors' ? item?.hors.lines : item?.appetiser.lines, clipStart, clipEnd)
  const pausedMark = host.played && host.state === STATE.PAUSED
  const openBoard = (event: ReactPointerEvent) => {
    event.stopPropagation()
    event.preventDefault()
    boardDrag.current = { y: event.clientY, opened: true }
  }
  const moveBoard = (event: ReactPointerEvent) => {
    const start = boardDrag.current
    if (!start) return
    event.stopPropagation()
    if ((event.target as HTMLElement).closest('button, a, input, textarea, select, label')) return
    if (!boardOpen && event.clientY < start.y - 24) setBoardOpen(true)
    if (boardOpen && event.clientY > start.y + 36) setBoardOpen(false)
  }
  const finishBoard = (event: ReactPointerEvent) => {
    const start = boardDrag.current
    boardDrag.current = null
    if (!start) return
    event.stopPropagation()
    event.preventDefault()
    if ((event.target as HTMLElement).closest('button, a, input, textarea, select, label')) return
    const dy = event.clientY - start.y
    if (dy < -28) setBoardOpen(true)
    else if (dy > 36) setBoardOpen(false)
    else if (Math.abs(dy) < 14) setBoardOpen((open) => !open)
  }
  const visiblePlayer = () => {
    const id = hosts.current[visibleRef.current].playerId
    return id ? getPlayer(id) : null
  }
  const cycleSpeed = () => {
    const next = nextPlaybackRate(speedRef.current)
    speedRef.current = next
    setSpeed(next)
    visiblePlayer()?.setPlaybackRate?.(next)
  }
  const scrubTo = (ratio: number) => {
    const player = visiblePlayer()
    if (!player) return
    const next = clipStart + clipLength * ratio
    player.seekTo(next, true)
    setSpokenAt(next)
  }
  const chrome = item && phase === 'feed' && !slide && !scenic ? (
    <>
      <div className="j-hairline-row">
        <div className={`j-hairline${buffering ? ' shimmer' : ''}`} data-testid="hairline"><i style={{ width: `${clipPlaying ? clipPct : 0}%` }} /></div>
        <div className="clip-row">
          <div className="clip-row-top">
            {mode === 'appetiser' ? (
              <button type="button" className="chip white" onClick={() => { window.location.assign(`${base}/feed`) }} data-testid="appetiser-back">‹ Back</button>
            ) : (
              <button type="button" className="chip white" onClick={() => { window.location.assign(base) }} data-testid="feed-back">‹ Back</button>
            )}
          </div>
        </div>
      </div>
      {pausedMark ? <span className="j-paused-mark" data-testid="paused-mark" aria-hidden>❚❚</span> : null}
      {scenicAppetiser ? (
        <div className="scenic-lines" data-testid="scenic-lines">
          {scenicLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        className="j-more-tab"
        data-testid="more-board"
        aria-expanded={boardOpen}
        aria-label={boardOpen ? 'Hide more' : 'More'}
        onPointerDown={openBoard}
        onPointerMove={moveBoard}
        onPointerUp={finishBoard}
        onPointerCancel={() => { boardDrag.current = null }}
        onClick={(event) => event.preventDefault()}
      >
        <i />
        More
      </button>
      {boardOpen ? <div className="j-board-back" data-testid="board-back" onClick={() => setBoardOpen(false)} /> : null}
      {boardOpen ? (
      <div
        className="j-board"
        data-testid="feed-board"
        onPointerDown={(event) => { event.stopPropagation(); boardDrag.current = { y: event.clientY, opened: true } }}
        onPointerMove={moveBoard}
        onPointerUp={finishBoard}
      >
        <span className="j-board-handle" />
        <span className="chip gold" data-testid="level-chip">{READY_FOR_MORE}</span>
        {laneVisible ? <span className="chip white" data-testid="lane-chip">Lane · {item.laneLabel}</span> : <span data-testid="lane-chip-hidden" />}
        <p className="j-swipe-hint" data-testid="swipe-hint">↑ swipe up for the next clip</p>
        {mode === 'hors' ? (
          <div className="ready-controls">
            <button type="button" className="chip gold" data-testid="speed" aria-label="Playback speed" onClick={cycleSpeed}>{speed}×</button>
            <span className="chip dark" data-testid="clip-timer">{clock(clipLeft)}</span>
          </div>
        ) : null}
      <div className="rail">
        <button type="button" data-testid="share" onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => { event.stopPropagation(); event.preventDefault(); void share() }} onClick={(event) => event.preventDefault()}><span className="bubble"><ShareIcon /></span>Share</button>
        <button type="button" aria-pressed={faves.includes(item.id)} data-testid="fave" onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => { event.stopPropagation(); event.preventDefault(); fave() }} onClick={(event) => event.preventDefault()}><span className="bubble"><HeartIcon filled={faves.includes(item.id)} /></span>Like</button>
        <button type="button" aria-pressed={saved.includes(item.id)} data-testid="save" onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => { event.stopPropagation(); event.preventDefault(); if (!needsAccount('save')) toggleSave(item.id) }} onClick={(event) => event.preventDefault()}><span className="bubble"><SaveIcon /></span>{saved.includes(item.id) ? 'Saved' : 'Save'}</button>
      </div>
      <div className="clip-foot j-credits">
        <div
          className="j-level-choices"
          data-testid="level-steps"
          aria-label="Choose how much to watch"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button type="button" className={mode === 'hors' ? 'on' : undefined} data-testid="level-clip" aria-pressed={mode === 'hors'} onPointerUp={(event) => { event.stopPropagation(); event.preventDefault(); requestClip() }} onClick={(event) => { event.preventDefault(); requestClip() }}>{LEVEL_WORDS[0]}</button>
          <button type="button" className={mode === 'appetiser' ? 'on' : undefined} data-testid="level-minutes" aria-pressed={mode === 'appetiser'} onPointerUp={(event) => { event.stopPropagation(); event.preventDefault(); requestExtract() }} onClick={(event) => { event.preventDefault(); requestExtract() }}>{LEVEL_WORDS[1]}</button>
          <button type="button" data-testid="level-lecture" onPointerUp={(event) => { event.stopPropagation(); event.preventDefault(); requestTalk() }} onClick={(event) => { event.preventDefault(); requestTalk() }}>{LEVEL_WORDS[2]}</button>
        </div>
        {mode === 'hors' ? (
          <>
            {speakerRow}
            <button type="button" className="j-more-speaker" data-testid="more-from-speaker" onClick={moreFromSpeaker}>More from {item.speaker} ›</button>
            <button type="button" className="pill gold block" data-testid="learn-more" data-parent={horsParent?.parentId || ''} data-parent-level="appetiser" data-speaker={item.speaker} data-lesson={item.lessonId} onPointerUp={(event) => { event.stopPropagation(); event.preventDefault(); requestExtract() }} onClick={(event) => { event.preventDefault(); requestExtract() }}>{(() => {
              const lead = clipCta.label && !/^learn more\b/i.test(clipCta.label) ? clipCta.label : clipStepUpLabel()
              const seconds = item.talkSeconds || pieceSeconds(item.appetiser)
              return withTalkDetail(lead, 1, seconds)
            })()}</button>
          </>
        ) : (
          <>
            <div className="ready-controls" data-testid="ready-controls">
              <button type="button" className="chip gold" data-testid="speed" onClick={cycleSpeed}>{speed}×</button>
              <span className="chip dark" data-testid="appetiser-timer">{clock(clipElapsed)} / {clock(clipLength)}</span>
              <input
                type="range"
                min={0}
                max={1000}
                value={Math.round(clipPct * 10)}
                data-testid="appetiser-scrub"
                aria-label="Place in this talk"
                onChange={(event) => scrubTo(Number(event.target.value) / 1000)}
              />
            </div>
            <a className="pill gold block" href={course} onPointerUp={(event) => { event.stopPropagation(); event.preventDefault(); requestTalk() }} onClick={(event) => { event.preventDefault(); requestTalk() }} data-testid="learn-more" data-parent={appetiserParent?.parentId || ''} data-parent-level="talk" data-speaker={item.speaker} data-lesson={item.lessonId}>{(() => {
              const talks = Object.values(opening.clips).filter((row) => row.courseId === item.courseId).reduce((ids, row) => ids.add(row.lessonId), new Set<number>()).size
              const computed = talkStepUpLabel(talks, item.talkSeconds)
              const custom = talkCta.label && !/^learn more\b/i.test(talkCta.label) && talkCta.label !== talkStepUpLabel(1) && (talkCta.running || talkCta.label !== computed)
              return custom ? withTalkDetail(talkCta.label, talks, item.talkSeconds) : computed
            })()}</a>
            <div className="speaker-card">
              <Avatar name={item.speaker} portrait={item.portrait} />
              <a className="who" href={`${base}/speaker/${item.speakerSlug}`} data-testid="speaker-bio-link"><b>{item.speaker}</b>{item.laneLabel ? <small>On {item.laneLabel}</small> : null}</a>
              <FollowButton slug={item.speakerSlug} className="follow teal" />
            </div>
            <button type="button" className="j-more-speaker" data-testid="more-from-speaker" onClick={moreFromSpeaker}>More from {item.speaker} ›</button>
          </>
        )}
      </div>
      </div>
      ) : null}
    </>
  ) : null

  return (
    <div ref={rootRef} className={`journey ${overlay ? 'overlay' : 'strict'} phase-${phase}`} data-testid="journey" data-phase={phase} data-mode={mode} data-playing={host.state === STATE.PLAYING ? 'yes' : 'no'} data-video={mode === 'appetiser' ? (videoAppetiser ? 'yes' : 'no') : undefined} data-appetiser-video={mode === 'appetiser' ? (videoAppetiser ? 'yes' : 'no') : undefined} data-index={index} data-card={cardKind || 'talk'} data-cut={item?.cutId ?? ''} data-lesson={item?.lessonId ?? ''} data-lesson-title={item?.lessonTitle || ''} data-course-title={item?.courseTitle || ''} data-cuts={items.map((row) => row.cutId).join(' ')} data-lane={item?.lane || ''} data-speaker={item?.speaker || ''} data-speaker-slug={item?.speakerSlug || ''} data-chrome={overlay ? 'over' : 'around'} data-vertical={item?.vertical ? 'yes' : undefined} data-words-in-picture={wordsInPicture ? 'yes' : undefined} data-framing="F" data-board={boardOpen ? 'open' : 'closed'} data-player-state={host.state} data-player-muted={muted ? 'yes' : 'no'} data-seen={seenCuts.join(' ')} data-seen-cards={seenCards.join(' ')}>
      <PageHelp page={phase === 'help' ? 'help' : phase === 'feed' ? (mode === 'appetiser' ? 'appetiser' : 'feed') : 'start'} />
      <div className="j-sky" aria-hidden>
        {Array.from({ length: 8 }, (_, at) => (
          <div key={at} ref={(el) => { skyRefs.current[at] = el }} className={`j-sky-layer s${at}`} style={{ opacity: at === 0 ? 1 : 0 }} />
        ))}
      </div>

      {phase === 'feed' ? (
        <div className="j-peeks" aria-hidden data-testid="peeks">
          {peeks.map(({ swipe, at }) => (
            <div key={swipe} ref={(el) => { peekEls.current[swipe] = el }} className="j-peek" data-testid="peek" data-peek={swipe} data-index={at} style={{ transform: peekRest(swipe) }}>
              {items[at] ? <PeekFace item={items[at]} mode={mode} /> : null}
            </div>
          ))}
        </div>
      ) : null}

      <div ref={clipRef} className="j-clip" data-screen={phase === 'feed' || phase === 'handoff' ? 'clip' : undefined}>
        <div ref={slotRef} className="j-slot" data-testid="player-slot" data-framing="F" style={{ visibility: phase === 'feed' || phase === 'handoff' ? 'visible' : 'hidden' }}>
          {[0, 1].map((at) => {
            const row = hosts.current[at as 0 | 1]
            const filmOn = hostShouldShow(at === visibleHost, revealed, Boolean(slide || scenic || !currentSpec))
            return (
              <div
                key={at}
                ref={(el) => { hostEls.current[at] = el }}
                className={`yt-host ${filmOn ? 'on' : 'off'}`}
                data-testid={filmOn ? 'player-visible' : 'player-hidden'}
                style={{ visibility: filmOn ? 'visible' : 'hidden' }}
              />
            )
          })}
          {phase === 'feed' && item ? (
            <SpokenWords
              sentences={spokenSentences}
              time={spokenAt ?? clipStart}
              speaker={undefined}
              title={item.lessonTitle || item.courseTitle}
              titles={[item.lessonTitle, item.courseTitle]}
              from={clipStart}
              to={clipEnd}
            />
          ) : null}
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
              data-style={item?.typography?.style}
              onEnded={() => window.dispatchEvent(new CustomEvent('hearts:ended'))}
            />
          ) : null}
          {showPoster && item && !slide ? (
            <div className={`j-poster${slow === 'breathe' ? ' breathe' : ''}${scenicAppetiser ? ' scenic' : ''}`} data-testid="poster-frame" data-poster={mode === 'appetiser' && item.cleanThumb ? 'frame' : 'own'}>
              <PosterStill item={item} mode={mode} />
              <span className="j-poster-mark" aria-hidden><Arch size={28} /></span>
              {showPlayControl ? (
                <button type="button" className="j-poster-play" aria-label="Play" data-testid="poster-play" onClick={() => { tapSound(); userPausedRef.current = false; const playing = hosts.current[visibleRef.current]; if (playing.spec) wantPlayRef.current = playing.spec.key; tryPlay() }}>
                  <PlayIcon size={30} />
                </button>
              ) : null}
              <span className="j-poster-who">{item.speaker}</span>
              {offline ? <p className="j-poster-note" data-testid="offline-note">{phase === 'handoff' || index === 0 ? "You're offline. Your first clip will play as soon as you're back." : "You're offline. We'll carry on from here when you're back."}</p> : null}
              {errorNote ? <p className="j-poster-note" data-testid="cannot-play">{errorNote}</p> : null}
              {slow === 'retry' && !offline && phase !== 'handoff' ? (
                item.transcriptReady ? (
                  <a className="pill white small j-read-instead" href={course} data-testid="read-instead">Read it instead ›</a>
                ) : (
                  <button type="button" className="pill white small" onClick={retry} data-testid="try-again">Try again</button>
                )
              ) : null}
            </div>
          ) : null}
          {phase === 'feed' && !item ? <div className="j-poster" data-testid="poster-frame" data-poster="own" data-empty="" /> : null}
          {phase === 'feed' && !slide && !scenic && !feedCard ? <div className="j-gesture" data-testid="gesture-layer" data-capture="yes" {...swipe} /> : null}
        </div>
        {slide && item ? (
          <div className="j-slide" data-testid="gesture-layer" {...swipe}>
            <Slide item={item} style={slide} onMore={() => void stepUp()} />
          </div>
        ) : null}
        <div className="j-chrome" data-swipe={overlay && !feedCard ? undefined : ''} {...(overlay && !feedCard ? {} : swipe)}>
          {chrome}
        </div>
        {appetiserOver && mode === 'appetiser' && item && phase === 'feed' ? (
          <div className="end-card" data-testid="appetiser-end">
            <p className="eyebrow">This one is finished.</p>
            <a className="pill gold block" href={course} data-testid="end-full" onPointerUp={(event) => { event.preventDefault(); requestTalk() }} onClick={(event) => { event.preventDefault(); requestTalk() }}>Watch the full talk</a>
            <button type="button" className="pill block end-feed" data-testid="end-feed" onClick={() => { setAppetiserOver(false); void showItem(index, 'hors') }}>Back to the feed</button>
            {swipeTarget(items, index, 'appetiser', 'next') != null ? (
              <button type="button" className="pill block end-next" data-testid="end-next" onClick={() => { const next = swipeTarget(items, index, 'appetiser', 'next'); setAppetiserOver(false); if (next != null) void advance(next) }}>Watch the next longer clip</button>
            ) : null}
          </div>
        ) : null}
      </div>

      {phase === 'handoff' && line ? <p className="j-line" data-testid="handoff-line">{line}</p> : null}

      {phase === 'opener' || phase === 'scene' || phase === 'handoff' ? (
        <div className="j-layer" data-testid="scene-layer">
          {phase === 'opener' ? (
            <Opener caption={props.opener.caption} subline={props.opener.subline} onPlay={letsPlay} onJustShow={justShow} loginHref={loginHref} signedIn={signedIn} sceneCount={scenes.length} />
          ) : null}
          {leaving !== null && scenes[leaving] && phase === 'scene' ? (
            <div ref={leavingRef} className="j-scene-wrap leaving" aria-hidden>
              <SceneCard scene={scenes[leaving]} index={leaving} total={scenes.length + 1} selected={null} reply={null} picked={null} onPick={() => undefined} onPass={() => undefined} onJustShow={() => undefined} />
            </div>
          ) : null}
          {(phase === 'scene' || phase === 'handoff') && scenes[sceneAt] ? (
            <div ref={sceneRef} className="j-scene-wrap" key={sceneAt}>
              <SceneCard
                scene={scenes[sceneAt]}
                index={sceneAt}
                total={scenes.length + 1}
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

      {toast?.trim() ? <div className="lane-switch" data-testid="toast"><span key={toast}>{toast.trim()}</span></div> : null}

      <div className="sr-only">
        {phase === 'feed' ? (
          <>
            <button type="button" data-testid="gesture-up" onClick={replay}>Replay this clip</button>
            <button type="button" data-testid="gesture-down" onClick={nextLane}>Switch lane</button>
            <button type="button" data-testid="gesture-left" onClick={moreLikeThis}>More on this topic</button>
            <button type="button" data-testid="gesture-right" onClick={moreFromSpeaker}>More from this speaker</button>
            <button type="button" tabIndex={-1} aria-hidden="true" data-testid="gesture-next" onClick={() => stepLoop(1)}>Next clip on this level</button>
            <button type="button" tabIndex={-1} aria-hidden="true" data-testid="gesture-prev" onClick={() => stepLoop(-1)}>Previous clip on this level</button>
          </>
        ) : null}
      </div>

      {coach && phase === 'feed' ? (
        <div className="j-coach" data-testid="swipe-coach" onClick={dismissCoach}>
          <div className="j-coach-card">
            <h2>How to move around</h2>
            <ul>
              <li><b>Swipe up</b> The next clip.</li>
              <li><b>Swipe down</b> Switch lane.</li>
              <li><b>Swipe left</b> More on this topic.</li>
              <li><b>Swipe right</b> More from this speaker.</li>
            </ul>
            <p>Tap here, or swipe once, to hide this.</p>
          </div>
        </div>
      ) : null}

      {tabs && phase === 'feed' ? (
        <TabEntry
          base={base}
          unread={props.unread}
          features={props.features}
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

/** The still a card opens on: its scene, or our own poster (YouTube's large frame only when it carries no words). */
function stillOf(item: FeedItem | undefined, mode: Mode) {
  if (!item) return null
  if (mode === 'hors' && item.style && !item.typography?.src && !isInterstitial(item)) return SLIDE_BACKDROP[item.style]
  if (mode === 'appetiser' && item.cleanThumb) return item.cleanThumb
  return item.poster && !/i\.ytimg\.com|img\.youtube\.com|^\/clips\//i.test(item.poster) ? item.poster : null
}

function PosterStill({ item, mode }: { item: FeedItem; mode: Mode; peek?: boolean }) {
  const [frameFailed, setFrameFailed] = useState(false)
  const frame = mode === 'appetiser' && item.cleanThumb && !frameFailed ? item.cleanThumb : null
  return (
    <>
      {frame ? (
        // A missing maxresdefault comes back as YouTube's 120px grey stand-in rather than an error.
        <img src={frame} alt="" onError={() => setFrameFailed(true)} onLoad={(event) => { if (event.currentTarget.naturalWidth <= 120) setFrameFailed(true) }} />
      ) : item.poster && !/i\.ytimg\.com|img\.youtube\.com|^\/clips\//i.test(item.poster) ? (
        <img src={item.poster} alt="" />
      ) : null}
    </>
  )
}

/** A neighbour as it first appears, drawn from stills already decoded: nothing here waits on a player. */
function PeekFace({ item, mode }: { item: FeedItem; mode: Mode }) {
  if (isInterstitial(item)) {
    return (
      <div className="j-poster">
        <PosterStill item={item} mode={mode} peek />
        <span className="j-poster-mark" aria-hidden><Arch size={28} /></span>
        <span className="j-poster-who">{item.speaker}</span>
      </div>
    )
  }
  if (mode === 'hors' && item.style && !item.typography?.src) {
    return (
      <div className={`slide ${item.style}`}>
        <div className="bg" style={{ backgroundImage: `url(${SLIDE_BACKDROP[item.style]})` }} />
      </div>
    )
  }
  return (
    <div className="j-poster">
      <PosterStill item={item} mode={mode} peek />
      <span className="j-poster-mark" aria-hidden><Arch size={28} /></span>
      <span className="j-poster-who">{item.speaker}</span>
    </div>
  )
}

function TabEntry({
  base,
  unread,
  features,
  onGuard,
}: {
  base: string
  unread: number
  features?: import('@/lib/features').FeatureMap
  onGuard: (event: React.MouseEvent) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    animate(ref.current, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], 300, EASE.enter, { id: 'tabbar-in' })
  }, [])
  return (
    <div ref={ref} className="j-tabs" onClickCapture={onGuard}>
      <TabBar base={`${base}`} active={null} portal={{ features }} dark unread={unread} />
    </div>
  )
}
