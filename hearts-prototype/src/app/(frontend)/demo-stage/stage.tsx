'use client'

import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  DEMO_SCENARIOS,
  castHeader,
  fillCast,
  isViewCommand,
  runDemoCommand,
  scenarioById,
  seedDemo,
  stageFor,
  tidyCast,
  type DemoCast,
  type DemoPanel,
} from '@/lib/demo-stage'
import { CastScreen } from './cast'
import { Board } from './panels'
import { DemoProvider, useDemo, type DemoViews } from './store'

const PANELS: { slot: DemoPanel; phone?: boolean }[] = [
  { slot: 'master' },
  { slot: 'portal' },
  { slot: 'teacher' },
  { slot: 'learner', phone: true },
]

const START: DemoViews = { master: 'portals', portal: 'overview', teacher: 'queue', learner: 'home' }

const DESTINATION: Record<string, Partial<DemoViews>> = {
  'show-library': { master: 'library' },
  'show-imported': { portal: 'imported' },
  'open-content': { portal: 'content' },
  'add-video': { portal: 'content' },
  'open-question': { portal: 'question' },
  'pause-moment': { portal: 'question' },
  'save-question': { portal: 'question' },
  'save-later': { portal: 'question' },
  publish: { portal: 'content', learner: 'home' },
  'open-home': { learner: 'home' },
  'open-course': { learner: 'course' },
  'open-player': { learner: 'player' },
  'send-answer': { learner: 'player' },
  'open-queue': { teacher: 'queue' },
  'send-reply': { teacher: 'queue' },
  'open-workbook': { learner: 'workbook' },
  'open-announce': { portal: 'announce' },
  'post-announce': { portal: 'announce', learner: 'home' },
  'open-features': { portal: 'features' },
  'toggle-live': { portal: 'features', learner: 'home' },
  'toggle-workbook': { portal: 'features' },
}

type Layout = 'row' | 'grid' | 'phone'

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

export function DemoStage() {
  return (
    <DemoProvider>
      <Stage />
    </DemoProvider>
  )
}

function Stage() {
  const { state, cast, setCast, glow, replace, setViews, resetViews } = useDemo()
  const [castOpen, setCastOpen] = useState(true)
  const [introduced, setIntroduced] = useState(false)
  const [reveal, setReveal] = useState(false)
  const [focusOn, setFocusOn] = useState(true)
  useEffect(() => {
    if (!reveal) return
    const timer = window.setTimeout(() => setReveal(false), 1100)
    return () => window.clearTimeout(timer)
  }, [reveal])
  const [layout, setLayout] = useState<Layout>('row')
  const [flex, setFlex] = useState([1, 1, 1])
  const [gridSplit, setGridSplit] = useState(1)
  const [stepsOpen, setStepsOpen] = useState(true)
  const [scenarioId, setScenarioId] = useState('')
  const [index, setIndex] = useState(0)
  const scenario = scenarioById(scenarioId)
  const step = scenario && index < scenario.steps.length ? scenario.steps[index] : null
  const columns = layout === 'grid' ? `${gridSplit}fr 1fr` : `${flex[0]}fr ${flex[1]}fr ${flex[2]}fr 430px`

  function drag(at: number, event: ReactPointerEvent) {
    event.preventDefault()
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

  function start(id: string) {
    const chosen = scenarioById(id)
    if (!chosen) return
    replace(stageFor(id))
    setScenarioId(id)
    setIndex(0)
    const first = chosen.steps[0]
    setViews({ ...START, [first.panel]: first.view })
  }

  function press(id: string) {
    const next = runDemoCommand(state, id)
    const changed = next !== state
    if (changed) replace(next, next.ticker[0]?.slot)
    const jump = DESTINATION[id]
    const following = scenario && step?.target === id && (changed || isViewCommand(id)) ? scenario.steps[index + 1] : undefined
    const advanced = Boolean(scenario && step?.target === id && (changed || isViewCommand(id)))
    setViews((current) => {
      const withDest = jump ? { ...current, ...jump } : current
      if (!following) return withDest
      return { ...withDest, [following.panel]: following.view }
    })
    if (advanced) setIndex(index + 1)
  }

  function reset() {
    replace(seedDemo())
    resetViews()
    setScenarioId('')
    setIndex(0)
  }

  function showCast(next: DemoCast) {
    setCast(tidyCast(next))
    setCastOpen(false)
    if (!introduced) {
      setIntroduced(true)
      setReveal(true)
    }
  }

  const focus = focusOn && step ? step.panel : null

  return (
    <div className={`demo-stage layout-${layout}${stepsOpen && introduced ? ' steps-open' : ''}`} data-testid="demo-stage">
      <header className="demo-bar">
        <div className="demo-title">
          <p className="demo-kicker">HEARTS · sample only</p>
          <h1>Demo stage</h1>
        </div>
        <div className="demo-presets" role="group" aria-label="Layout">
          <button type="button" className={layout === 'row' ? 'on' : ''} data-testid="demo-layout-row" onClick={() => setLayout('row')}>4 across</button>
          <button type="button" className={layout === 'grid' ? 'on' : ''} data-testid="demo-layout-grid" onClick={() => setLayout('grid')}>2×2</button>
          <button type="button" className={layout === 'phone' ? 'on' : ''} data-testid="demo-layout-phone" onClick={() => setLayout('phone')}>3 + phone</button>
        </div>
        <div className="demo-actions">
          <button type="button" data-testid="demo-edit-cast" onClick={() => setCastOpen(true)}>Edit cast</button>
          <button type="button" className={focusOn ? 'on' : ''} aria-pressed={focusOn} data-testid="demo-focus" onClick={() => setFocusOn((on) => !on)}>{focusOn ? 'Focus on' : 'Focus off'}</button>
          <button type="button" data-testid="demo-steps-toggle" onClick={() => setStepsOpen((open) => !open)}>{stepsOpen ? 'Hide steps' : 'Demo steps'}</button>
          <button type="button" className="danger" data-testid="demo-reset" onClick={reset}>Reset demo</button>
        </div>
      </header>
      {introduced ? <>
      <div className="demo-body">
        <div className={`demo-board${reveal ? ' is-reveal' : ''}${focus ? ' is-focusing' : ''}`} data-testid="demo-board" data-focus={focus || 'off'} style={{ gridTemplateColumns: columns }}>
          {PANELS.map((panel, at) => (
            <div className={`demo-cell${focus && focus !== panel.slot ? ' is-dim' : ''}${focus === panel.slot ? ' is-live' : ''}`} key={panel.slot}>
              {at > 0 && (layout !== 'grid' || at === 1) ? (
                <button type="button" className="demo-resize" aria-label={`Resize ${castHeader(cast, panel.slot)}`} onPointerDown={(event) => drag(at - 1, event)} />
              ) : null}
              <section
                className={`demo-panel${glow.includes(panel.slot) ? ' is-glow' : ''}${panel.phone ? ' is-phone' : ''}`}
                data-testid={`demo-panel-${panel.slot}`}
                data-slot={panel.slot}
              >
                <Strip cast={cast} slot={panel.slot} setCast={setCast} />
                <div className="demo-view">
                  {panel.phone ? (
                    <div className="demo-phone" data-testid="demo-phone">
                      <div className="demo-bezel">
                        <div className="demo-notch" />
                        <Board only="learner" hot={step?.target || ''} press={press} />
                      </div>
                    </div>
                  ) : (
                    <Board only={panel.slot} hot={step?.target || ''} press={press} />
                  )}
                </div>
              </section>
            </div>
          ))}
        </div>
        {stepsOpen ? (
          <aside className="demo-steps" data-testid="demo-steps">
            <h2>Demo steps</h2>
            <p>Pick a beat from the school demos. The next button lights up. Nothing is saved.</p>
            <ol>
              {DEMO_SCENARIOS.map((item) => (
                <li key={item.id}>
                  <button type="button" data-testid={`demo-scenario-${item.id}`} className={scenarioId === item.id ? 'on' : ''} onClick={() => start(item.id)}>
                    {item.title}
                  </button>
                  <span>{fillCast(item.blurb, cast)}</span>
                </li>
              ))}
            </ol>
            {step ? <p className="demo-say" data-testid="demo-step-say">{fillCast(step.say, cast)}</p> : scenario ? <p className="demo-say">That beat is done. Pick another, or press Reset demo.</p> : null}
          </aside>
        ) : null}
      </div>
      <footer className="demo-ticker" data-testid="demo-ticker">
        <span>Activity</span>
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

