'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { Hidden } from '@/components/app/shell'
import styles from './experiment-form.module.css'

type Option = { value: string; label: string }

export type ExperimentFormDraft = {
  action: 'create' | 'update'
  id?: string
  next: string
  key: string
  name: string
  description: string
  slot: string
  slotOverride: string
  portal: string
  allocation: string
  primaryMetric: string
  secondary: string
  variants: string
  existing: boolean
  cancelHref: string
  rule: string
  slots: Option[]
  portals: Option[]
  metrics: Option[]
}

export function ExperimentForm({ draft }: { draft: ExperimentFormDraft }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/experiments', {
        method: 'POST',
        headers: { accept: 'application/json' },
        body: new FormData(form),
      })
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: unknown; id?: number; notice?: string }
      if (!response.ok || data.ok === false) {
        setError(typeof data.error === 'string' ? data.error : 'That did not work.')
        return
      }
      if (data.id) {
        window.location.assign(draft.next.replace(/\/new$/, `/${data.id}`))
        return
      }
      window.location.assign(draft.next)
    } catch {
      setError('That did not work.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form panel" action="/api/experiments" method="post" data-testid="experiment-form" onSubmit={onSubmit}>
      <header><h2>{draft.existing ? 'Details' : 'Start from a slot'}</h2></header>
      <Hidden fields={{ action: draft.action, id: draft.id || '', next: draft.next }} />
      <div className={`body ${styles.fields}`}>
        {error ? <div className="flash error" role="alert" data-testid="error">{error}</div> : null}
        <label className="stack">Key
          <input name="key" defaultValue={draft.key} required autoComplete="off" disabled={draft.existing} data-testid="experiment-key" />
        </label>
        <label className="stack">Name
          <input name="name" defaultValue={draft.name} required data-testid="experiment-name" />
        </label>
        <label className="stack">What you are testing
          <textarea name="description" defaultValue={draft.description} rows={3} />
        </label>
        <label className="stack">Slot
          <select name="slot" defaultValue={draft.slot} disabled={draft.existing} data-testid="experiment-slot-field">
            {draft.slots.map((slot) => <option key={slot.value} value={slot.value}>{slot.label}</option>)}
          </select>
        </label>
        {draft.existing ? null : (
          <label className="stack">Or type a slot key
            <input name="slotOverride" defaultValue={draft.slotOverride} placeholder="lanes-tab-label" data-testid="experiment-slot-key" />
            <span className={styles.hint} data-testid="slot-key-hint">Only listed slots are allowed. A sheikh’s words cannot be a slot.</span>
          </label>
        )}
        <label className="stack">Portal
          <select name="portal" defaultValue={draft.portal}>
            <option value="">Every portal</option>
            {draft.portals.map((portal) => <option key={portal.value} value={portal.value}>{portal.label}</option>)}
          </select>
        </label>
        <label className="stack">Split
          <select name="allocation" defaultValue={draft.allocation} data-testid="experiment-allocation">
            <option value="fixed">Fixed split</option>
            <option value="auto">Auto (Thompson sampling, 10% floor)</option>
          </select>
        </label>
        <label className="stack">Primary metric
          <select name="primaryMetric" defaultValue={draft.primaryMetric} data-testid="experiment-metric">
            {draft.metrics.map((metric) => <option key={metric.value} value={metric.value}>{metric.label}</option>)}
          </select>
        </label>
        <label className="stack">Secondary metrics
          <input name="secondary" defaultValue={draft.secondary} placeholder="appetiser_complete, return_next_day" />
          <span className={styles.hint} data-testid="secondary-hint">Comma-separated extras to watch, such as appetiser_complete or return_next_day.</span>
        </label>
        <label className="stack">Versions, one per line as <code>key | label</code>
          <textarea name="variants" defaultValue={draft.variants} rows={6} data-testid="experiment-variants" />
        </label>
        <p className="muted" style={{ margin: 0 }}>{draft.rule}</p>
        <div className="actions" style={{ justifyContent: 'flex-start' }}>
          <button className="btn" type="submit" data-testid="experiment-save" disabled={busy}>{draft.existing ? 'Save' : 'Create draft'}</button>
          <Link className="btn ghost" href={draft.cancelHref}>Cancel</Link>
        </div>
      </div>
    </form>
  )
}
