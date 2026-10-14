'use client'

import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  LOOP_PLAY,
  fillCast,
  receiversFor,
  reduceDemo,
  seedDemo,
  tidyCast,
  type DemoAction,
  type DemoCast,
  type DemoPanel,
  type PromptKind,
  type QueueKind,
} from '@/lib/demo-stage'
import { CastScreen } from './cast'
import { Board } from './panels'
import { RealPhone } from './phone'
import { DemoProvider, useDemo } from './store'

const PANELS: { slot: DemoPanel; phone?: boolean }[] = [
  { slot: 'master' },
  { slot: 'portal' },
  { slot: 'teacher' },
  { slot: 'learner', phone: true },
]

const FROM: Record<string, string> = {
  course: 'demo-add-course',
  note: 'demo-post-note',
  question: 'demo-ask',
  workbook: 'demo-ask',
  answer: 'demo-learner-prompts',
  book: 'demo-learner-prompts',
  comment: 'demo-comment',
  reply: 'demo-queue',
  rollup: 'demo-stuck',
}

type Spot = { actor: DemoPanel; receivers: DemoPanel[] }
type Layout = 'row' | 'grid' | 'phone'

function scrollTo(anchor: string) {
  document.querySelector(`[data-anchor="${anchor}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

function HeaderName({ value, testId, onSave }: { value: string; testId: string; onSave: (next: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const cancel = useRef(false)
  const openedAt = useRef(0)
  if (!editing) {
    return (
      <button type="button" className="demo-name" data-testid={testId} title="Click to type a new name" onClick={() => { openedAt.current = Date.now(); setDraft(value); setEditing(true) }}>
        {value}
      </button>
    )
  }
  return (
    <input
      className="demo-name-input"
      data-testid={`${testId}-input`}
      value={draft}
      autoFocus
      aria-label="Name"
      style={{ width: `${Math.max(draft.length, value.length, 2) + 1}ch` }}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => {
        if (Date.now() - openedAt.current < 400) {
          event.currentTarget.focus()
          return
        }
        if (cancel.current) {
          cancel.current = false
          return
        }
        const next = draft.trim()
        if (next && next !== value) onSave(next)
        setEditing(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          openedAt.current = 0
          event.currentTarget.blur()
        }
        if (event.key === 'Escape') {
          cancel.current = true
          openedAt.current = 0
          setEditing(false)
        }
      }}
    />
  )
}

function Strip({ cast, slot, setCast }: { cast: DemoCast; slot: DemoPanel; setCast: (next: DemoCast) => void }) {
  if (slot === 'master') {
    return (
      <header className="demo-strip">
        <HeaderName value={cast.master} testId="demo-name-master" onSave={(master) => setCast({ ...cast, master })} />
        <span>, running the whole system</span>
      </header>
    )
  }
  if (slot === 'portal') {
    return (
      <header className="demo-strip">
        <HeaderName value={cast.portalAdmin} testId="demo-name-admin" onSave={(portalAdmin) => setCast({ ...cast, portalAdmin })} />
        <span>, looking after </span>
        <HeaderName value={cast.portalName} testId="demo-name-portal" onSave={(portalName) => setCast({ ...cast, portalName })} />
      </header>
    )
  }
  if (slot === 'teacher') {
    return (
      <header className="demo-strip">
        <HeaderName value={cast.teacher} testId="demo-name-teacher" onSave={(teacher) => setCast({ ...cast, teacher })} />
        <span>, guiding the learners</span>
      </header>
    )
  }
  return (
    <header className="demo-strip">
      <HeaderName value={cast.learner} testId="demo-name-learner" onSave={(learner) => setCast({ ...cast, learner })} />
      <span>, a learner at </span>
      <HeaderName value={cast.portalName} testId="demo-name-place" onSave={(portalName) => setCast({ ...cast, portalName })} />
    </header>
  )
}

export function DemoStage({ learnerSrc }: { learnerSrc: string }) {
  return (
    <DemoProvider>
      <Stage learnerSrc={learnerSrc} />
    </DemoProvider>
  )
}

function Stage({ learnerSrc }: { learnerSrc: string }) {
  const { state, cast, setCast, glow, replace, pulse } = useDemo()
  const stateRef = useRef(state)
  stateRef.current = state
  const [castOpen, setCastOpen] = useState(true)
  const [introduced, setIntroduced] = useState(false)
  const [reveal, setReveal] = useState(false)
  const [focusOn, setFocusOn] = useState(true)
  const [layout, setLayout] = useState<Layout>('row')
  const [flex, setFlex] = useState([1, 1, 1])
  const [gridSplit, setGridSplit] = useState(1)
  const [resized, setResized] = useState(false)
  const [stepsOpen, setStepsOpen] = useState(true)
  const [spot, setSpot] = useState<Spot | null>(null)
  const [index, setIndex] = useState(-1)
  const [status, setStatus] = useState<'idle' | 'playing' | 'done'>('idle')
  const [homeTick, setHomeTick] = useState(0)
  const playing = useRef(false)
  const timer = useRef(0)
  const step = index >= 0 ? LOOP_PLAY[index] : null
  const columns = layout === 'grid' ? `${gridSplit}fr 1fr` : `${flex[0]}fr ${flex[1]}fr ${flex[2]}fr minmax(260px, 390px)`
  const live = focusOn && spot ? new Set<DemoPanel>([spot.actor, ...spot.receivers]) : null

  useEffect(() => {
    if (!reveal) return
    const id = window.setTimeout(() => setReveal(false), 1100)
    return () => window.clearTimeout(id)
  }, [reveal])

  useEffect(() => () => {
    playing.current = false
    window.clearTimeout(timer.current)
  }, [])

  function drag(at: number, event: ReactPointerEvent) {
    event.preventDefault()
    setResized(true)
    const startX = event.clientX
    const start = flex.slice()
    const startSplit = gridSplit
    const width = (event.currentTarget.parentElement?.parentElement as HTMLElement | null)?.getBoundingClientRect().width || 1
    function move(ev: PointerEvent) {
      const delta = (ev.clientX - startX) / width
      if (layout === 'grid') {
        setGridSplit(Math.min(2.4, Math.max(0.45, startSplit + delta * 2)))
        return
      }
      const next = start.slice()
      const scaled = delta * (start[0] + start[1] + start[2])
      next[at] = Math.max(0.45, start[at] + scaled)
      if (at + 1 < next.length) next[at + 1] = Math.max(0.45, start[at + 1] - scaled)
      setFlex(next)
    }
    function up() {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function land(action: DemoAction | undefined, actor: DemoPanel, receivers: DemoPanel[], anchor: string) {
    if (action) {
      const next = reduceDemo(stateRef.current, action)
      if (next !== stateRef.current) {
        stateRef.current = next
        replace(next, receivers)
      } else pulse(receivers)
    } else {
      pulse(receivers)
    }
    setSpot({ actor, receivers })
    scrollTo(anchor)
  }

  function stopPlay() {
    playing.current = false
    window.clearTimeout(timer.current)
    setStatus((current) => (current === 'playing' ? 'idle' : current))
  }

  function arm(at: number) {
    if (!playing.current) return
    const next = LOOP_PLAY[at]
    if (!next) {
      playing.current = false
      setIndex(-1)
      setStatus('done')
      setSpot(null)
      return
    }
    setIndex(at)
    setStatus('playing')
    setSpot({ actor: next.actor, receivers: [] })
    scrollTo(FROM[next.id] || next.anchor)
    timer.current = window.setTimeout(() => {
      if (!playing.current) return
      land(next.action, next.actor, next.receivers, next.anchor)
      timer.current = window.setTimeout(() => arm(at + 1), 1200)
    }, 700)
  }

  function startPlay() {
    stopPlay()
    const seeded = seedDemo()
    stateRef.current = seeded
    replace(seeded)
    setSpot(null)
    setIndex(0)
    playing.current = true
    setStatus('playing')
    setHomeTick((tick) => tick + 1)
    timer.current = window.setTimeout(() => arm(0), 350)
  }

  function runStep(at: number) {
    const next = LOOP_PLAY[at]
    if (!next) return
    stopPlay()
    setIndex(at)
    land(next.action, next.actor, next.receivers, next.anchor)
  }

  function apply(action: DemoAction, actor: DemoPanel) {
    stopPlay()
    const receivers = receiversFor(action)
    const next = reduceDemo(stateRef.current, action)
    if (next === stateRef.current) return
    stateRef.current = next
    replace(next, receivers)
    setSpot({ actor, receivers })
    setIndex(-1)
  }

  function reset() {
    stopPlay()
    replace(seedDemo())
    setSpot(null)
    setIndex(-1)
    setStatus('idle')
    setHomeTick((tick) => tick + 1)
  }

  function showCast(next: DemoCast) {
    setCast(tidyCast(next))
    setCastOpen(false)
    if (!introduced) {
      setIntroduced(true)
      setReveal(true)
    }
  }

  return (
    <div className={`demo-stage layout-${layout}${stepsOpen && introduced ? ' steps-open' : ''}`} data-testid="demo-stage">
      <header className="demo-bar">
        <div className="demo-title">
          <p className="demo-kicker">Hady Core · sample only</p>
          <h1 data-testid="demo-header-title">Hady Core Demo stage</h1>
        </div>
        <div className="demo-presets" role="group" aria-label="Layout">
          <button type="button" className={layout === 'row' ? 'on' : ''} data-testid="demo-layout-row" onClick={() => { setResized(false); setLayout('row') }}>4 across</button>
          <button type="button" className={layout === 'grid' ? 'on' : ''} data-testid="demo-layout-grid" onClick={() => { setResized(false); setLayout('grid') }}>2×2</button>
          <button type="button" className={layout === 'phone' ? 'on' : ''} data-testid="demo-layout-phone" onClick={() => { setResized(false); setLayout('phone') }}>3 + phone</button>
        </div>
        <div className="demo-actions">
          <button type="button" data-testid="demo-edit-cast" onClick={() => setCastOpen(true)}>Edit cast</button>
          <button type="button" className={focusOn ? 'on' : ''} aria-pressed={focusOn} data-testid="demo-focus" onClick={() => setFocusOn((on) => !on)}>{focusOn ? 'Focus on' : 'Focus off'}</button>
          <button type="button" data-testid="demo-steps-toggle" onClick={() => setStepsOpen((open) => !open)}>{stepsOpen ? 'Hide steps' : 'Play the loop'}</button>
          <button type="button" className="danger" data-testid="demo-reset" onClick={reset}>Reset demo</button>
        </div>
      </header>
      {introduced ? <>
      <div className="demo-body">
        <div
          className={`demo-board${reveal ? ' is-reveal' : ''}${live ? ' is-focusing' : ''}`}
          data-testid="demo-board"
          data-focus={live ? [...live].join(' ') : 'off'}
          data-actor={focusOn && spot ? spot.actor : 'off'}
          style={resized ? { gridTemplateColumns: columns } : undefined}
        >
          {PANELS.map((panel, at) => (
            <div className={`demo-cell${live && !live.has(panel.slot) ? ' is-dim' : ''}${live?.has(panel.slot) ? ' is-live' : ''}`} key={panel.slot}>
              {at > 0 && (layout !== 'grid' || at === 1) ? (
                <button type="button" className="demo-resize" aria-label="Resize panels" onPointerDown={(event) => drag(at - 1, event)} />
              ) : null}
              <section
                className={`demo-panel${glow.includes(panel.slot) ? ' is-glow' : ''}${panel.phone ? ' is-phone' : ''}`}
                data-testid={`demo-panel-${panel.slot}`}
                data-slot={panel.slot}
              >
                <Strip cast={cast} slot={panel.slot} setCast={setCast} />
                <div className="demo-view">
                  {panel.phone ? (
                    <RealPhone src={learnerSrc} />
                  ) : (
                    <Board
                      only={panel.slot}
                      homeTick={homeTick}
                      onRun={(action) => apply(action, panel.slot)}
                      onCourse={(title) => apply({ type: 'add-course', title }, 'master')}
                      onNote={(body) => apply({ type: 'post-note', body }, 'portal')}
                      onPrompt={(kind: PromptKind, text: string) => apply({ type: 'set-prompt', kind, text }, 'teacher')}
                      onWrite={(kind: QueueKind, body: string, promptId?: string) => apply({ type: 'write', kind, body, promptId }, 'learner')}
                      onReply={(id, body) => apply({ type: 'reply', id, body }, 'teacher')}
                    />
                  )}
                </div>
              </section>
            </div>
          ))}
        </div>
        {stepsOpen ? (
          <aside className="demo-steps" data-testid="demo-steps">
            <h2>Play the loop</h2>
            <p>One change goes down to the phone, then comes back up. Nothing is saved.</p>
            <div className="demo-play-row">
              <button type="button" className="go" data-testid="demo-play" onClick={startPlay}>{status === 'playing' ? 'Playing…' : 'Play the loop'}</button>
              {status === 'playing' ? <button type="button" data-testid="demo-play-stop" onClick={stopPlay}>Stop</button> : null}
            </div>
            <ol>
              {LOOP_PLAY.map((item, at) => (
                <li key={item.id}>
                  <button type="button" data-testid={`demo-loop-${item.id}`} className={index === at ? 'on' : ''} onClick={() => runStep(at)}>
                    {at + 1}. {item.actor === 'master' ? 'Master' : item.actor === 'portal' ? 'Admin' : item.actor === 'teacher' ? 'Teacher' : 'Learner'}
                  </button>
                  <span>{fillCast(item.say, cast)}</span>
                </li>
              ))}
            </ol>
            <p className="demo-say" data-testid="demo-step-say" data-status={status}>
              {step ? fillCast(step.say, cast) : status === 'done' ? 'The loop is done. Type your own, or press Reset demo.' : 'Press Play the loop, or type in any panel.'}
            </p>
          </aside>
        ) : null}
      </div>
      <footer className="demo-ticker" data-testid="demo-ticker">
        <span>Just now</span>
        {state.ticker.length ? (
          <ul>
            {state.ticker.map((row) => <li key={row.id}>{fillCast(row.text, cast)}</li>)}
          </ul>
        ) : <p>Waiting for a change in the sample.</p>}
      </footer>
      </> : null}
      {castOpen ? (
        <CastScreen
          initial={cast}
          editing={introduced}
          onShow={showCast}
          onCancel={introduced ? () => setCastOpen(false) : undefined}
        />
      ) : null}
    </div>
  )
}
