'use client'

import { useState } from 'react'
import {
  CAST_QUICK,
  castFilled,
  castPrompt,
  rollCast,
  type CastStep,
  type DemoCast,
  type PortalKind,
} from '@/lib/demo-stage'

const KINDS: { id: PortalKind; label: string }[] = [
  { id: 'mosque', label: 'Mosque' },
  { id: 'school', label: 'School' },
  { id: 'company', label: 'Company' },
]

export function CastScreen({
  initial,
  editing,
  onShow,
  onCancel,
}: {
  initial: DemoCast
  editing: boolean
  onShow: (cast: DemoCast) => void
  onCancel?: () => void
}) {
  const [draft, setDraft] = useState(initial)
  const [rolls, setRolls] = useState<Record<CastStep, number>>({ master: 0, portal: 0, teacher: 0, learner: 0 })
  const ready = castFilled(draft)
  const placeLabel = draft.kind === 'school' ? 'School name' : draft.kind === 'company' ? 'Company name' : 'Mosque name'

  function dice(step: CastStep) {
    const next = rolls[step] + 1
    setRolls({ ...rolls, [step]: next })
    setDraft(rollCast(draft, step, next - 1))
  }

  return (
    <div className="demo-cast-layer" data-testid="demo-cast">
      <section className="demo-cast" role="dialog" aria-modal="true" aria-labelledby="demo-cast-title">
        <p className="demo-kicker">Cast your demo</p>
        <h2 id="demo-cast-title">Name the four people</h2>
        <p className="demo-cast-lead">One of each. The audience can say the names out loud.</p>
        <div className="demo-cast-grid">
          <label className="demo-cast-field">
            <span>{castPrompt('master', draft.kind)}</span>
            <input data-testid="demo-cast-master" value={draft.master} onChange={(event) => setDraft({ ...draft, master: event.target.value })} />
            <span className="demo-cast-picks">
              {CAST_QUICK.master.map((name) => (
                <button key={name} type="button" data-testid="demo-cast-pick" className={draft.master === name ? 'on' : ''} onClick={() => setDraft({ ...draft, master: name })}>{name}</button>
              ))}
              <button type="button" className="dice" data-testid="demo-cast-dice-master" onClick={() => dice('master')}>Make up a name</button>
            </span>
          </label>
          <div className="demo-cast-field">
            <span data-testid="demo-cast-portal-prompt">{castPrompt('portal', draft.kind)}</span>
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
            <label>
              <em>Their name</em>
              <input data-testid="demo-cast-admin" value={draft.portalAdmin} onChange={(event) => setDraft({ ...draft, portalAdmin: event.target.value })} />
            </label>
            <label>
              <em>{placeLabel}</em>
              <input data-testid="demo-cast-portal" value={draft.portalName} onChange={(event) => setDraft({ ...draft, portalName: event.target.value })} />
            </label>
            <span className="demo-cast-picks">
              {CAST_QUICK.portal[draft.kind].map((pair) => (
                <button
                  key={pair.place}
                  type="button"
                  data-testid="demo-cast-pick"
                  className={draft.portalAdmin === pair.person && draft.portalName === pair.place ? 'on' : ''}
                  onClick={() => setDraft({ ...draft, portalAdmin: pair.person, portalName: pair.place })}
                >
                  {pair.person} · {pair.place}
                </button>
              ))}
              <button type="button" className="dice" data-testid="demo-cast-dice-portal" onClick={() => dice('portal')}>Make up a name</button>
            </span>
          </div>
          <label className="demo-cast-field">
            <span>{castPrompt('teacher', draft.kind)}</span>
            <input data-testid="demo-cast-teacher" value={draft.teacher} onChange={(event) => setDraft({ ...draft, teacher: event.target.value })} />
            <span className="demo-cast-picks">
              {CAST_QUICK.teacher.map((name) => (
                <button key={name} type="button" data-testid="demo-cast-pick" className={draft.teacher === name ? 'on' : ''} onClick={() => setDraft({ ...draft, teacher: name })}>{name}</button>
              ))}
              <button type="button" className="dice" data-testid="demo-cast-dice-teacher" onClick={() => dice('teacher')}>Make up a name</button>
            </span>
          </label>
          <label className="demo-cast-field">
            <span>{castPrompt('learner', draft.kind)}</span>
            <input data-testid="demo-cast-learner" value={draft.learner} onChange={(event) => setDraft({ ...draft, learner: event.target.value })} />
            <span className="demo-cast-picks">
              {CAST_QUICK.learner.map((name) => (
                <button key={name} type="button" data-testid="demo-cast-pick" className={draft.learner === name ? 'on' : ''} onClick={() => setDraft({ ...draft, learner: name })}>{name}</button>
              ))}
              <button type="button" className="dice" data-testid="demo-cast-dice-learner" onClick={() => dice('learner')}>Make up a name</button>
            </span>
          </label>
        </div>
        <div className="demo-cast-nav">
          {editing && onCancel ? <button type="button" data-testid="demo-cast-cancel" onClick={onCancel}>Cancel</button> : <span />}
          <button type="button" className="go" data-testid="demo-cast-show" disabled={!ready} onClick={() => ready && onShow(draft)}>
            {editing ? 'Done' : 'Show all four'}
          </button>
        </div>
      </section>
    </div>
  )
}
