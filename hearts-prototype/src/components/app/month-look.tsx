'use client'

import { useState } from 'react'
import { Hidden } from '@/components/app/shell'

type Scene = { key: string; caption: string; subline?: string; options: { key: string; label: string }[] }
type Life = { key: string; label: string }

/** One question at a time, then the life check-in, then Keep this month. */
export function MonthLook({
  scenes,
  life,
  lifeCaption,
  formId,
  portal,
  next,
}: {
  scenes: Scene[]
  life: Life[]
  lifeCaption: string
  formId: string
  portal: string
  next: string
}) {
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState<'on' | 'back'>('on')
  const [picks, setPicks] = useState<Record<string, string>>({})
  const lastQuestion = Math.max(0, scenes.length - 1)
  const onLife = step >= scenes.length
  const scene = scenes[step]

  function go(nextStep: number, direction: 'on' | 'back') {
    setDir(direction)
    setStep(nextStep)
  }

  function choose(key: string, option: string) {
    setPicks((current) => ({ ...current, [key]: option }))
    window.setTimeout(() => go(Math.min(scenes.length, step + 1), 'on'), 220)
  }

  return (
    <form action="/api/compass" method="post" className="month-look">
      <Hidden fields={{ next, portal, form: formId, ...picks }} />
      {onLife ? (
        <fieldset key="life" className={`card month-card ${dir}`} data-testid="life-check">
          <legend>{lifeCaption}</legend>
          <p className="muted">Tick any that fit. Leave them if none do.</p>
          {life.map((option) => (
            <label key={option.key} className="choice">
              <input type="checkbox" name={`life-${option.key}`} value="yes" />
              <span>{option.label}</span>
            </label>
          ))}
          <label className="note-label" htmlFor="life-note">A line, if you want to add one</label>
          <textarea id="life-note" name="lifeNote" maxLength={280} rows={3} data-testid="life-note" placeholder="Optional." />
          <button className="pill gold block" type="submit" data-testid="month-save">Keep this month</button>
          <button className="text-back" type="button" data-testid="month-back" onClick={() => go(lastQuestion, 'back')}>Back</button>
        </fieldset>
      ) : scene ? (
        <fieldset key={scene.key} className={`card month-card ${dir}`} data-testid="month-scene" data-scene={scene.key}>
          <p className="progress" data-testid="progress">{step + 1} of {scenes.length}</p>
          <span className="progress-line" aria-hidden="true"><i style={{ width: `${((step + 1) / scenes.length) * 100}%` }} /></span>
          <legend>{scene.caption}</legend>
          {scene.subline ? <p className="muted">{scene.subline}</p> : null}
          {scene.options.map((option) => (
            <label key={option.key} className="choice">
              <input type="radio" value={option.key} checked={picks[scene.key] === option.key} onChange={() => choose(scene.key, option.key)} />
              <span>{option.label}</span>
            </label>
          ))}
          {step > 0 ? <button className="text-back" type="button" data-testid="month-back" onClick={() => go(step - 1, 'back')}>Back</button> : null}
        </fieldset>
      ) : null}
    </form>
  )
}
