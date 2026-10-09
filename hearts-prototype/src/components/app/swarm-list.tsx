'use client'

import { useMemo, useState } from 'react'
import { orderSwarm, type SwarmMode } from '@/lib/swarm-sort'

export type SwarmFace = { name: string; body: string; image?: string | null; circle?: boolean; initials: string }

const DOTS = ['#d4a84b', '#c9d6b0', '#e4d4f4', '#e8a15a', '#e7a0b4']

export function SwarmList({
  items,
  mine,
  circleLabel,
}: {
  items: SwarmFace[]
  mine?: string | null
  circleLabel?: string
}) {
  const [mode, setMode] = useState<SwarmMode>('mix')
  const answered = Boolean(mine && mine.trim())
  const shown = useMemo(() => orderSwarm(items, mine, answered ? mode : 'mix', `${mine || 'mix'}:${items.length}`), [items, mine, mode, answered])
  return (
    <div className="others" data-testid="swarm" data-mode={answered ? mode : 'mix'}>
      <p className="eyebrow">What others said</p>
      {answered ? (
        <div className="swarm-tools" data-testid="swarm-tools">
          <button type="button" className={`chip${mode === 'like' ? ' on' : ''}`} data-testid="swarm-like-mine" onClick={() => setMode((current) => (current === 'like' ? 'mix' : 'like'))}>
            Answers like mine
          </button>
          <button type="button" className={`chip${mode === 'surprise' ? ' on' : ''}`} data-testid="swarm-surprise" onClick={() => setMode((current) => (current === 'surprise' ? 'mix' : 'surprise'))}>
            Surprise me
          </button>
        </div>
      ) : null}
      {shown.length ? (
        shown.map((item, at) => (
          <div className="other" key={`${item.initials}-${at}`} data-testid="swarm-item" data-source={item.circle ? 'circle' : 'learner'}>
            <span className="dot" style={{ background: DOTS[at % DOTS.length] }} />
            <div>
              <b data-testid="swarm-initials">{item.initials}</b>
              {item.circle && circleLabel ? <small className="circle-note" data-testid="circle-label">{circleLabel}</small> : null}
              <p>&lsquo;{item.body}&rsquo;</p>
              {item.image ? <img src={item.image} alt="" /> : null}
            </div>
          </div>
        ))
      ) : (
        <p className="muted" style={{ fontSize: 14 }} data-testid="swarm-empty">
          Nobody has shared an answer here yet. Private answers never appear in this list.
        </p>
      )}
    </div>
  )
}
