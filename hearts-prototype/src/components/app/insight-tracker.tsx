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
  return document.documentElement.getAttribute('data-lane')
    || document.querySelector('[data-testid="journey"]')?.getAttribute('data-lane')
    || ''
}

function answerSheetOpen() {
  if (typeof document === 'undefined') return false
  return Boolean(document.querySelector('[data-testid="popup"]'))
}

function notePath(path: string) {
  noteRoute(path)
  if (path.endsWith('/start') || path.includes('/welcome')) noteFunnel('opening_questions', path)
  if (path.includes('/feed')) noteFunnel('first_clip', path)
  if (/\/course\//.test(path)) noteFunnel('course_start', path)
}

export function InsightTracker({ trendsOptIn }: { trendsOptIn?: boolean } = {}) {
  useEffect(() => {
    if (trendsOptIn) document.documentElement.setAttribute('data-trends', 'on')
    let last = window.location.pathname
    notePath(last)
    const seeMove = () => {
      const path = window.location.pathname
      if (path === last) return
      last = path
      notePath(path)
    }

    const onPointer = (event: PointerEvent) => {
      const route = window.location.pathname
      if (isAnswerScreen(route, { sheet: answerSheetOpen() })) {
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
      if (isAnswerScreen(window.location.pathname, { sheet: answerSheetOpen() }) || isPrivateLane(readLane())) return
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
    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!link) return
      window.setTimeout(seeMove, 80)
    }
    window.addEventListener('pointerdown', onPointer, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('hearts-insight', onInsight)
    window.addEventListener('popstate', seeMove)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('hearts-insight', onInsight)
      window.removeEventListener('popstate', seeMove)
      document.removeEventListener('click', onClick, true)
    }
  }, [trendsOptIn])
  return null
}
