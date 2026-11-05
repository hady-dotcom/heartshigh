'use client'

import { useRef, useState } from 'react'
import { Hidden } from '@/components/app/shell'

type Scene = { key: string; caption: string; subline?: string; options: { key: string; label: string }[] }
type Life = { key: string; label: string }

/** One question at a time, then the life check-in, then Keep this month. */
export function MonthLook({
  scenes,
  life,
  lifeCaption,
  intro,
  formId,
  portal,
  next,
}: {
  scenes: Scene[]
  life: Life[]
  lifeCaption: string
  intro?: string
  formId: string
  portal: string
  next: string
}) {
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState<'on' | 'back'>('on')
  const [leaving, setLeaving] = useState<number | null>(null)
  const [picks, setPicks] = useState<Record<string, string>>({})
  const slideTimer = useRef<number | null>(null)
  const lastQuestion = Math.max(0, scenes.length - 1)
  const onLife = step >= scenes.length
  const scene = scenes[step]

  function go(nextStep: number, direction: 'on' | 'back') {
    if (slideTimer.current) window.clearTimeout(slideTimer.current)
    setLeaving(step)
    setDir(direction)
    setStep(nextStep)
    slideTimer.current = window.setTimeout(() => setLeaving(null), 350)
  }

  function choose(key: string, option: string) {
    setPicks((current) => ({ ...current, [key]: option }))
    window.setTimeout(() => go(Math.min(scenes.length, step + 1), 'on'), 360)
  }

  function card(index: number, direction: 'on' | 'back', gone: boolean) {
    const classes = `card month-card${direction === 'back' ? ' back' : ''}${gone ? ' leave' : ''}`
    if (index >= scenes.length) {
      return (
        <fieldset key={gone ? 'life-leave' : 'life'} className={classes} data-testid={gone ? undefined : 'life-check'}>
          <legend>{lifeCaption}</legend>
          <p className="muted">Tick any that fit. Leave them if none do.</p>
          {life.map((option) => (
            <label key={option.key} className="choice">
              <input type="checkbox" name={gone ? undefined : `life-${option.key}`} value="yes" tabIndex={gone ? -1 : undefined} />
              <span>{option.label}</span>
            </label>
          ))}
          <label className="note-label" htmlFor={gone ? undefined : 'life-note'}>A line, if you want to add one</label>
          <textarea id={gone ? undefined : 'life-note'} name={gone ? undefined : 'lifeNote'} maxLength={280} rows={3} data-testid={gone ? undefined : 'life-note'} placeholder="Optional." tabIndex={gone ? -1 : undefined} />
          {gone ? null : <button className="pill gold block" type="submit" data-testid="month-save">Keep this month</button>}
          <button className="back month-back" type="button" data-testid={gone ? undefined : 'month-back'} tabIndex={gone ? -1 : undefined} onClick={() => go(lastQuestion, 'back')}>‹ Back</button>
        </fieldset>
      )
    }
    const shown = scenes[index]
    if (!shown) return null
    return (
      <fieldset key={gone ? `${shown.key}-leave` : shown.key} className={classes} data-testid={gone ? undefined : 'month-scene'} data-scene={shown.key}>
        <legend>{shown.caption}</legend>
        {shown.subline ? <p className="muted">{shown.subline}</p> : null}
        {shown.options.map((option) => (
          <label key={option.key} className="choice">
            <input type="radio" value={option.key} checked={picks[shown.key] === option.key} onChange={() => choose(shown.key, option.key)} tabIndex={gone ? -1 : undefined} />
            <span>{option.label}</span>
          </label>
        ))}
        {index > 0 ? <button className="back month-back" type="button" data-testid={gone ? undefined : 'month-back'} tabIndex={gone ? -1 : undefined} onClick={() => go(index - 1, 'back')}>‹ Back</button> : null}
      </fieldset>
    )
  }

  return (
    <form action="/api/compass" method="post" className="month-look">
      <Hidden fields={{ next, portal, form: formId, ...picks }} />
      {!onLife && scene ? (
        <div className="month-progress">
          <span className="progress-line" aria-hidden="true"><i style={{ width: `${((step + 1) / scenes.length) * 100}%` }} /></span>
          <p className="progress" data-testid="progress">{step + 1} of {scenes.length}</p>
        </div>
      ) : null}
      {step === 0 && !onLife && intro ? <p className="lead">{intro}</p> : null}
      <div className="month-stage">
        {leaving != null && leaving !== step ? card(leaving, dir, true) : null}
        {onLife || scene ? card(step, dir, false) : null}
      </div>
    </form>
  )
}
