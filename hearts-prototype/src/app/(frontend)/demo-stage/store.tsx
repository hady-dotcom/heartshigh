'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  DEMO_CHANNEL,
  type DemoCast,
  type DemoPanel,
  type DemoState,
  defaultCast,
  demoChannelMessage,
  readChannelMessage,
  seedDemo,
} from '@/lib/demo-stage'

export type DemoViews = { master: string; portal: string; teacher: string; learner: string }

type DemoApi = {
  state: DemoState
  cast: DemoCast
  setCast: (next: DemoCast) => void
  views: DemoViews
  glow: DemoPanel[]
  replace: (next: DemoState, slot?: DemoPanel) => void
  setViews: (update: DemoViews | ((current: DemoViews) => DemoViews)) => void
  resetViews: () => void
}

const START_VIEWS: DemoViews = { master: 'portals', portal: 'overview', teacher: 'queue', learner: 'home' }

const Ctx = createContext<DemoApi | null>(null)

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(seedDemo)
  const [cast, setCast] = useState<DemoCast>(defaultCast)
  const [views, setViews] = useState<DemoViews>(START_VIEWS)
  const [glow, setGlow] = useState<DemoPanel[]>([])
  const channel = useRef<BroadcastChannel | null>(null)
  const glowTimer = useRef(0)

  useEffect(() => {
    const bus = new BroadcastChannel(DEMO_CHANNEL)
    channel.current = bus
    bus.onmessage = (event) => {
      setState((current) => readChannelMessage(current, event.data))
    }
    return () => {
      bus.close()
      channel.current = null
    }
  }, [])

  const replace = useCallback((next: DemoState, slot?: DemoPanel) => {
    setState(next)
    channel.current?.postMessage(demoChannelMessage(next))
    if (!slot) return
    setGlow([slot])
    window.clearTimeout(glowTimer.current)
    glowTimer.current = window.setTimeout(() => setGlow([]), 1600)
  }, [])

  const resetViews = useCallback(() => setViews(START_VIEWS), [])

  return <Ctx.Provider value={{ state, cast, setCast, views, glow, replace, setViews, resetViews }}>{children}</Ctx.Provider>
}

export function useDemo() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('Demo stage is missing its store.')
  return ctx
}
