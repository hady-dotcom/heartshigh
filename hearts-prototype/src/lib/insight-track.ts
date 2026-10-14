'use client'

import { angryFromLatest, type TapPoint } from './insight-taps'
import { sanitizeProps } from './insight-events'
import { returnBucketFromDays } from './insight-funnel'

const LAST_VISIT_KEY = 'hearts.lastVisit'
let sentReturnBucket = false

function localDateKey(at = new Date()) {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`
}

function daysBetween(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00`)
  const end = Date.parse(`${to}T00:00:00`)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  return Math.round((end - start) / 86_400_000)
}

/** Last-visit date stays on the device. Only a coarse bucket is sent, once per visit. */
export function visitReturnBucket() {
  if (sentReturnBucket || typeof window === 'undefined') return null
  sentReturnBucket = true
  try {
    const today = localDateKey()
    const last = window.localStorage.getItem(LAST_VISIT_KEY)
    const days = last && /^\d{4}-\d{2}-\d{2}$/.test(last) ? daysBetween(last, today) : null
    const bucket = returnBucketFromDays(days)
    window.localStorage.setItem(LAST_VISIT_KEY, today)
    return bucket
  } catch {
    return null
  }
}

let memorySession = ''

/** Random per-visit id. Memory or sessionStorage only — never a cookie, learner, or device id. */
export function insightSessionId() {
  if (typeof window === 'undefined') return ''
  try {
    const key = 'hearts.insight.session'
    const held = window.sessionStorage.getItem(key)
    if (held && !/learner|device/i.test(held)) return held
    const next = `s${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
    window.sessionStorage.setItem(key, next)
    return next
  } catch {
    if (!memorySession) memorySession = `s${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
    return memorySession
  }
}

export type InsightPayload = {
  kind: string
  route?: string
  x?: number
  y?: number
  vw?: number
  vh?: number
  depth?: number
  clipId?: string
  watchPct?: number
  step?: string
  interactive?: boolean
  props?: Record<string, unknown>
}

const queue: InsightPayload[] = []
let timer: ReturnType<typeof setTimeout> | null = null
const recent: TapPoint[] = []

function readLane() {
  if (typeof document === 'undefined') return ''
  return document.documentElement.getAttribute('data-lane')
    || document.querySelector('[data-testid="journey"]')?.getAttribute('data-lane')
    || ''
}

function answerSheetOpen() {
  if (typeof document === 'undefined') return false
  return Boolean(document.querySelector('[data-testid="popup"][data-sheet="answer"]'))
}

function flush() {
  if (!queue.length || typeof window === 'undefined') return
  const bucket = visitReturnBucket()
  const events = queue.splice(0, 40).map((event, index) => ({
    ...event,
    sessionId: insightSessionId(),
    route: event.route || window.location.pathname,
    props: sanitizeProps({
      ...event.props,
      lane: event.props?.lane || readLane(),
      ...(answerSheetOpen() ? { sheet: true } : {}),
      ...(index === 0 && bucket ? { returnBucket: bucket } : {}),
    }),
  }))
  try {
    void fetch('/api/insights', {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ events }),
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    // ignore
  }
}

export function postInsight(event: InsightPayload) {
  if (typeof window === 'undefined') return
  queue.push(event)
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    flush()
  }, 400)
}

export function noteTap(x: number, y: number, interactive: boolean, opts?: { coords?: boolean }) {
  const at = Date.now()
  const incoming = { x, y, at }
  const keepCoords = opts?.coords !== false
  const angry = keepCoords ? angryFromLatest(recent, incoming) : null
  if (keepCoords) {
    recent.push(incoming)
    if (recent.length > 20) recent.splice(0, recent.length - 20)
  }
  postInsight({
    kind: 'tap',
    ...(keepCoords ? { x: Math.round(x), y: Math.round(y), vw: window.innerWidth, vh: window.innerHeight } : {}),
    interactive,
  })
  if (angry) {
    postInsight({
      kind: 'angry_tap',
      x: angry.x,
      y: angry.y,
      vw: window.innerWidth,
      vh: window.innerHeight,
      interactive,
    })
  }
}

export function noteRoute(path?: string) {
  postInsight({ kind: 'route', route: path })
}

export function noteScroll(depth: number) {
  postInsight({ kind: 'scroll', depth: Math.round(depth) })
}

export function noteFunnel(step: string, route?: string) {
  postInsight({ kind: 'funnel', step, route })
}

export function noteClip(kind: 'clip_watch' | 'clip_swipe', watchPct: number, clipId?: string) {
  postInsight({ kind, watchPct: Math.round(watchPct), clipId })
}

export { insightSessionId as sessionId }
