'use client'

import { useState } from 'react'
import {
  CAST_FLOW,
  CAST_QUICK,
  castPrompt,
  castReady,
  rollCast,
  type DemoCast,
  type PortalKind,
} from '@/lib/demo-stage'

const KINDS: { id: PortalKind; label: string }[] = [
  { id: 'mosque', label: 'Mosque' },
  { id: 'school', label: 'School' },
  { id: 'company', label: 'Company' },
]

export function CastScreen({ initial, onShow }: { initial: DemoCast; onShow: (cast: DemoCast) => void }) {
  const [draft, setDraft] = useState(initial)
  const [step, setStep] = useState(0)
  const [roll, setRoll] = useState(0)
  const id = CAST_FLOW[step]
  const last = step === CAST_FLOW.length - 1
  const ready = castReady(draft, id)

  function dice() {
    const next = roll + 1
    setRoll(next)
    setDraft(rollCast(draft, id, next - 1))
  }

  function forward() {
    if (!ready) return
    if (last) onShow(draft)
    else setStep(step + 1)
  }

  return (
    <section className="demo-cast" data-testid="demo-cast">
      <p className="demo-kicker">Cast your demo</p>
      <p className="demo-cast-count">One of each · {step + 1} of {CAST_FLOW.length}</p>
      <h2 data-testid="demo-cast-prompt">{castPrompt(id, draft.kind)}</h2>
      {id === 'portal' ? (
        <div className="demo-cast-kinds" role="group" aria-label="What kind of portal">
          {KINDS.map((kind) => (
            <button
              key={kind.id}
              type="button"
              className={draft.kind === kind.id ? 'on' : ''}
              data-testid={`demo-cast-kind-${kind.id}`}
              onClick={() => setDraft({ ...draft, kind: kind.id })}
            >
              {kind.label}
            </button>
          ))}
        </div>
      ) : null}
      <label className="demo-cast-field">
        <span>{id === 'portal' ? 'Their name' : 'Name'}</span>
        <input
          data-testid={`demo-cast-${id === 'portal' ? 'admin' : id}`}
          value={id === 'master' ? draft.master : id === 'portal' ? draft.portalAdmin : id === 'teacher' ? draft.teacher : draft.learner}
          onChange={(event) => {
            const value = event.target.value
            if (id === 'master') setDraft({ ...draft, master: value })
            else if (id === 'portal') setDraft({ ...draft, portalAdmin: value })
            else if (id === 'teacher') setDraft({ ...draft, teacher: value })
            else setDraft({ ...draft, learner: value })
          }}
        />
      </label>
      {id === 'portal' ? (
        <label className="demo-cast-field">
          <span>{draft.kind === 'school' ? 'School name' : draft.kind === 'company' ? 'Company name' : 'Mosque name'}</span>
          <input data-testid="demo-cast-portal" value={draft.portalName} onChange={(event) => setDraft({ ...draft, portalName: event.target.value })} />
        </label>
      ) : null}
      <div className="demo-cast-picks">
        {id === 'master' ? CAST_QUICK.master.map((name) => (
          <button key={name} type="button" data-testid="demo-cast-pick" className={draft.master === name ? 'on' : ''} onClick={() => setDraft({ ...draft, master: name })}>{name}</button>
        )) : null}
        {id === 'portal' ? CAST_QUICK.portal[draft.kind].map((pair) => (
          <button
            key={pair.place}
            type="button"
            data-testid="demo-cast-pick"
            className={draft.portalAdmin === pair.person && draft.portalName === pair.place ? 'on' : ''}
            onClick={() => setDraft({ ...draft, portalAdmin: pair.person, portalName: pair.place })}
          >
            {pair.person} · {pair.place}
          </button>
        )) : null}
        {id === 'teacher' ? CAST_QUICK.teacher.map((name) => (
          <button key={name} type="button" data-testid="demo-cast-pick" className={draft.teacher === name ? 'on' : ''} onClick={() => setDraft({ ...draft, teacher: name })}>{name}</button>
        )) : null}
        {id === 'learner' ? CAST_QUICK.learner.map((name) => (
          <button key={name} type="button" data-testid="demo-cast-pick" className={draft.learner === name ? 'on' : ''} onClick={() => setDraft({ ...draft, learner: name })}>{name}</button>
        )) : null}
        <button type="button" className="dice" data-testid="demo-cast-dice" onClick={dice}>Make up a name</button>
      </div>
      <div className="demo-cast-nav">
        {step > 0 ? <button type="button" data-testid="demo-cast-back" onClick={() => setStep(step - 1)}>Back</button> : <span />}
        <button type="button" className="go" data-testid={last ? 'demo-cast-show' : 'demo-cast-next'} disabled={!ready} onClick={forward}>
          {last ? 'Show all four' : 'Next'}
        </button>
      </div>
    </section>
  )
}
