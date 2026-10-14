'use client'

import { useEffect, useRef, useState } from 'react'
import {
  DEMO_BEATS,
  DEMO_POLL_MS,
  demoFrameName,
  demoFramePath,
  foldActivity,
  type DemoBeatId,
  type DemoEvent,
  type DemoSlot,
} from '@/lib/demo-stage'
import { resetDemo, runBeat } from './actions'

const PANELS: { slot: DemoSlot; label: string; tint: string; path: string; phone?: boolean }[] = [
  { slot: 'master', label: "Used as if you're the Master", tint: '#25214a', path: '/master/portals/demo-stage' },
  { slot: 'portal', label: "Used as if you're the Portal admin (HEARTS Demo)", tint: '#1f8a78', path: '/p/demo-stage/admin' },
  { slot: 'teacher', label: "Used as if you're a Teacher", tint: '#c48f2c', path: '/p/demo-stage/admin/teach' },
  { slot: 'learner', label: "Used as if you're a Learner", tint: '#7a4fa8', path: '/p/demo-stage', phone: true },
]

type Layout = 'row' | 'grid' | 'phone'

function Frame({ slot, label, path }: { slot: DemoSlot; label: string; path: string }) {
  return (
    <iframe
      className="demo-frame"
      name={demoFrameName(slot)}
      title={label}
      src={demoFramePath(slot, path)}
      data-testid={`demo-frame-${slot}`}
      data-slot={slot}
    />
  )
}

export function DemoStage() {
  const [layout, setLayout] = useState<Layout>('row')
  const [flex, setFlex] = useState([1, 1, 1])
  const [gridSplit, setGridSplit] = useState(1)
  const [stepsOpen, setStepsOpen] = useState(true)
  const [busy, setBusy] = useState<string>('')
  const [note, setNote] = useState('')
  const [ticker, setTicker] = useState<string[]>([])
  const [glow, setGlow] = useState<DemoSlot[]>([])
  const boardRef = useRef<HTMLDivElement>(null)
  const cursor = useRef(0)
  const primed = useRef(false)

  useEffect(() => {
    let stop = false
    async function poll() {
      try {
        const response = await fetch(`/api/demo-stage/activity?since=${cursor.current}`, { cache: 'no-store' })
        if (!response.ok) return
        const data = (await response.json()) as { events?: DemoEvent[]; cursor?: number }
        const events = data.events || []
        if (!primed.current) {
          primed.current = true
          cursor.current = data.cursor || 0
          return
        }
        if (!events.length) return
        cursor.current = data.cursor || cursor.current
        const folded = foldActivity(events)
        setTicker((prev) => [...events.map((event) => event.text).reverse(), ...prev].slice(0, 12))
        setGlow(folded.glow)
        window.setTimeout(() => setGlow([]), 1800)
        for (const slot of folded.refresh) {
          const frame = document.querySelector<HTMLIFrameElement>(`iframe[data-slot="${slot}"]`)
          try {
            frame?.contentWindow?.location.reload()
          } catch {
            if (frame) frame.src = frame.src
          }
        }
      } catch {
        // The next poll tries again.
      }
    }
    void poll()
    const timer = window.setInterval(() => {
      if (!stop) void poll()
    }, DEMO_POLL_MS)
    return () => {
      stop = true
      window.clearInterval(timer)
    }
  }, [])

  function drag(index: number, event: React.PointerEvent) {
    event.preventDefault()
    const startX = event.clientX
    const start = flex.slice()
    const startSplit = gridSplit
    const width = boardRef.current?.getBoundingClientRect().width || 1
    function move(ev: PointerEvent) {
      const delta = (ev.clientX - startX) / width
      if (layout === 'grid') {
        setGridSplit(Math.min(2.4, Math.max(0.45, startSplit + delta * 2)))
        return
      }
      const next = start.slice()
      const scaled = delta * (start[0] + start[1] + start[2])
      next[index] = Math.max(0.45, start[index] + scaled)
      if (index + 1 < next.length) next[index + 1] = Math.max(0.45, start[index + 1] - scaled)
      setFlex(next)
    }
    function up() {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  async function beat(id: DemoBeatId) {
    setBusy(id)
    setNote('')
    try {
      const result = await runBeat(id)
      if (!result.ok) setNote(result.error)
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'That step did not run.')
    } finally {
      setBusy('')
    }
  }

  const columns = layout === 'grid' ? `${gridSplit}fr 1fr` : `${flex[0]}fr ${flex[1]}fr ${flex[2]}fr 430px`

  return (
    <div className={`demo-stage layout-${layout}${stepsOpen ? ' steps-open' : ''}`} data-testid="demo-stage">
      <header className="demo-bar">
        <div className="demo-title">
          <p className="demo-kicker">HEARTS · sandbox</p>
          <h1>Demo stage</h1>
        </div>
        <div className="demo-presets" role="group" aria-label="Layout">
          <button type="button" className={layout === 'row' ? 'on' : ''} data-testid="demo-layout-row" onClick={() => setLayout('row')}>4 across</button>
          <button type="button" className={layout === 'grid' ? 'on' : ''} data-testid="demo-layout-grid" onClick={() => setLayout('grid')}>2×2</button>
          <button type="button" className={layout === 'phone' ? 'on' : ''} data-testid="demo-layout-phone" onClick={() => setLayout('phone')}>3 + phone</button>
        </div>
        <div className="demo-actions">
          <button type="button" data-testid="demo-steps-toggle" onClick={() => setStepsOpen((open) => !open)}>{stepsOpen ? 'Hide steps' : 'Guided steps'}</button>
          <form action={resetDemo}>
            <button type="submit" className="danger" data-testid="demo-reset">Reset demo</button>
          </form>
        </div>
      </header>

      <div className="demo-body">
        <div
          className="demo-board"
          ref={boardRef}
          data-testid="demo-board"
          style={columns ? { gridTemplateColumns: columns } : undefined}
        >
          {PANELS.map((panel, index) => (
            <div className="demo-cell" key={panel.slot} data-slot={panel.slot}>
              {index > 0 && (layout !== 'grid' || index === 1) ? (
                <button type="button" className="demo-resize" aria-label={`Resize ${panel.label}`} onPointerDown={(event) => drag(index - 1, event)} />
              ) : null}
              <section
                className={`demo-panel${glow.includes(panel.slot) ? ' is-glow' : ''}${panel.phone ? ' is-phone' : ''}`}
                data-testid={`demo-panel-${panel.slot}`}
                style={{ ['--tint' as string]: panel.tint }}
              >
                <header className="demo-strip">{panel.label}</header>
                <div className="demo-view">
                  {panel.phone ? (
                    <div className="demo-phone" data-testid="demo-phone">
                      <div className="demo-bezel">
                        <div className="demo-notch" />
                        <Frame slot={panel.slot} label={panel.label} path={panel.path} />
                      </div>
                    </div>
                  ) : (
                    <Frame slot={panel.slot} label={panel.label} path={panel.path} />
                  )}
                </div>
              </section>
            </div>
          ))}
        </div>

        {stepsOpen ? (
          <aside className="demo-steps" data-testid="demo-steps">
            <h2>Guided steps</h2>
            <p>Each step changes only the HEARTS Demo sandbox. The other desks refresh on their own.</p>
            <ol>
              {DEMO_BEATS.map((step) => (
                <li key={step.id}>
                  <button type="button" data-testid={`demo-beat-${step.id}`} disabled={Boolean(busy)} onClick={() => beat(step.id)}>
                    {busy === step.id ? 'Running…' : step.title}
                  </button>
                  <span>{step.detail}</span>
                </li>
              ))}
            </ol>
            {note ? <p className="demo-note" data-testid="demo-beat-error">{note}</p> : null}
          </aside>
        ) : null}
      </div>

      <footer className="demo-ticker" data-testid="demo-ticker">
        <span>Activity</span>
        {ticker.length ? (
          <ul>
            {ticker.map((line, index) => (
              <li key={`${line}-${index}`}>{line}</li>
            ))}
          </ul>
        ) : (
          <p>Waiting for a change in one of the desks.</p>
        )}
      </footer>
    </div>
  )
}
