'use client'

import { useEffect } from 'react'
import { isAnswerScreen, isPrivateLane } from '@/lib/insight-events'
import { noteClip, noteFunnel, noteRoute, noteScroll, noteTap } from '@/lib/insight-track'

function interactive(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('a, button, input, select, textarea, summary, [role="button"], [data-testid="learn-more"]'))
}

function readTrendsOptIn() {
  if (typeof document === 'undefined') return false
  return document.documentElement.getAttribute('data-trends') === 'on'
}

function readLane() {
  if (typeof document === 'undefined') return ''
  return document.documentElement.getAttribute('data-lane') || ''
}

export function InsightTracker({ trendsOptIn }: { trendsOptIn?: boolean } = {}) {
  useEffect(() => {
    if (trendsOptIn) document.documentElement.setAttribute('data-trends', 'on')
    noteRoute(window.location.pathname)
    const path = window.location.pathname
    if (path.endsWith('/start') || path.includes('/welcome')) noteFunnel('opening_questions', path)
    if (path.includes('/feed')) noteFunnel('first_clip', path)
    if (/\/course\//.test(path)) noteFunnel('course_start', path)

    const onPointer = (event: PointerEvent) => {
      const route = window.location.pathname
      if (isAnswerScreen(route)) {
        noteTap(0, 0, interactive(event.target), { coords: false })
        return
      }
      if (isPrivateLane(readLane())) return
      if (!readTrendsOptIn() && !trendsOptIn) {
        noteTap(0, 0, interactive(event.target), { coords: false })
        return
      }
      noteTap(event.clientX, event.clientY, interactive(event.target), { coords: true })
    }
    const onScroll = () => {
      if (isAnswerScreen(window.location.pathname) || isPrivateLane(readLane())) return
      if (!readTrendsOptIn() && !trendsOptIn) return
      const root = document.scrollingElement || document.documentElement
      const max = Math.max(1, root.scrollHeight - window.innerHeight)
      noteScroll(Math.min(100, Math.round((window.scrollY / max) * 100)))
    }
    const onInsight = (event: Event) => {
      const detail = (event as CustomEvent).detail as { kind?: string; step?: string; watchPct?: number; clipId?: string; route?: string; lane?: string } | undefined
      if (!detail?.kind) return
      if (detail.lane) document.documentElement.setAttribute('data-lane', detail.lane)
      if (isPrivateLane(detail.lane || readLane())) return
      if (detail.kind === 'funnel' && detail.step && detail.step !== 'study_plan_saved') noteFunnel(detail.step, detail.route)
      if (detail.kind === 'route') noteRoute(detail.route || window.location.pathname)
      if (detail.kind === 'clip_watch' || detail.kind === 'clip_swipe') {
        noteClip(detail.kind, Number(detail.watchPct || 0), detail.clipId)
      }
    }
    window.addEventListener('pointerdown', onPointer, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('hearts-insight', onInsight)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('hearts-insight', onInsight)
    }
  }, [trendsOptIn])
  return null
}
