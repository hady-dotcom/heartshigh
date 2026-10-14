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

type DemoApi = {
  state: DemoState
  cast: DemoCast
  setCast: (next: DemoCast) => void
  glow: DemoPanel[]
  replace: (next: DemoState, slots?: DemoPanel[]) => void
  pulse: (slots: DemoPanel[]) => void
}

const Ctx = createContext<DemoApi | null>(null)

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(seedDemo)
  const [cast, setCast] = useState<DemoCast>(defaultCast)
  const [glow, setGlow] = useState<DemoPanel[]>([])
  const channel = useRef<BroadcastChannel | null>(null)
  const stateRef = useRef(state)
  const glowTimer = useRef(0)
  stateRef.current = state

  useEffect(() => {
    const bus = new BroadcastChannel(DEMO_CHANNEL)
    channel.current = bus
    bus.onmessage = (event) => {
      setState((current) => {
        const next = readChannelMessage(current, event.data)
        stateRef.current = next
        return next
      })
    }
    return () => {
      bus.close()
      channel.current = null
      window.clearTimeout(glowTimer.current)
    }
  }, [])

  const pulse = useCallback((slots: DemoPanel[]) => {
    window.clearTimeout(glowTimer.current)
    setGlow([])
    if (!slots.length) return
    window.requestAnimationFrame(() => setGlow(slots))
    glowTimer.current = window.setTimeout(() => setGlow([]), 1700)
  }, [])

  const replace = useCallback((next: DemoState, slots?: DemoPanel[]) => {
    const changed = next !== stateRef.current
    stateRef.current = next
    setState(next)
    if (changed) channel.current?.postMessage(demoChannelMessage(next))
    if (slots) pulse(slots)
  }, [pulse])

  return <Ctx.Provider value={{ state, cast, setCast, glow, replace, pulse }}>{children}</Ctx.Provider>
}

export function useDemo() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('Demo stage is missing its store.')
  return ctx
}
