'use client'

import { useState } from 'react'
import { DEMO_ENTRY_START, DEMO_ENTRY_TITLE } from '@/lib/demo-stage'
import { DemoStage } from './stage'

const DOTS = [
  { key: 'master', label: 'Master', color: '#25214a' },
  { key: 'portal', label: 'Portal admin', color: '#1f8a78' },
  { key: 'teacher', label: 'Teacher', color: '#c48f2c' },
  { key: 'learner', label: 'Learner', color: '#7a4fa8' },
] as const

export function DemoDoor({ learnerSrc }: { learnerSrc: string }) {
  const [open, setOpen] = useState(false)
  if (open) return <DemoStage learnerSrc={learnerSrc} />
  return (
    <main className="demo-door" data-testid="demo-entry">
      <p className="demo-door-kicker">Hady Core · practice only</p>
      <ul className="demo-door-dots" aria-label="The four people">
        {DOTS.map((dot) => (
          <li key={dot.key}>
            <span className="demo-door-dot" data-testid={`demo-dot-${dot.key}`} style={{ background: dot.color }} />
            <span>{dot.label}</span>
          </li>
        ))}
      </ul>
      <h1 data-testid="demo-entry-title">{DEMO_ENTRY_TITLE}</h1>
      <p className="demo-door-note">No sign-in. What you do stays on this screen.</p>
      <button type="button" className="demo-door-start" data-testid="demo-start" onClick={() => setOpen(true)}>
        {DEMO_ENTRY_START}
      </button>
    </main>
  )
}
