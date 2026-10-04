'use client'

import { angryFromLatest, type TapPoint } from './insight-taps'
import { sessionId } from './experiment-track'
import { sanitizeProps } from './insight-events'

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

function flush() {
  if (!queue.length || typeof window === 'undefined') return
  const events = queue.splice(0, 40).map((event) => ({
    ...event,
    sessionId: sessionId(),
    route: event.route || window.location.pathname,
    props: sanitizeProps(event.props),
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

export function noteTap(x: number, y: number, interactive: boolean) {
  const at = Date.now()
  const incoming = { x, y, at }
  const angry = angryFromLatest(recent, incoming)
  recent.push(incoming)
  if (recent.length > 20) recent.splice(0, recent.length - 20)
  postInsight({
    kind: 'tap',
    x: Math.round(x),
    y: Math.round(y),
    vw: window.innerWidth,
    vh: window.innerHeight,
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

export { sessionId }
