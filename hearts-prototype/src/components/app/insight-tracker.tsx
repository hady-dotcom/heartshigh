'use client'

import { useEffect } from 'react'
import { noteClip, noteFunnel, noteRoute, noteScroll, noteTap } from '@/lib/insight-track'

function interactive(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('a, button, input, select, textarea, summary, [role="button"], [data-testid="learn-more"]'))
}

export function InsightTracker() {
  useEffect(() => {
    noteRoute(window.location.pathname)
    const path = window.location.pathname
    if (path.endsWith('/start') || path.includes('/welcome')) noteFunnel('opening_questions', path)
    if (path.includes('/feed')) noteFunnel('first_clip', path)
    if (/\/course\//.test(path)) noteFunnel('course_start', path)
    if (path.includes('/me/plan')) noteFunnel('study_plan_saved', path)

    const onPointer = (event: PointerEvent) => {
      noteTap(event.clientX, event.clientY, interactive(event.target))
    }
    const onScroll = () => {
      const root = document.scrollingElement || document.documentElement
      const max = Math.max(1, root.scrollHeight - window.innerHeight)
      noteScroll(Math.min(100, Math.round((window.scrollY / max) * 100)))
    }
    const onInsight = (event: Event) => {
      const detail = (event as CustomEvent).detail as { kind?: string; step?: string; watchPct?: number; clipId?: string } | undefined
      if (!detail?.kind) return
      if (detail.kind === 'funnel' && detail.step) noteFunnel(detail.step)
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
  }, [])
  return null
}
