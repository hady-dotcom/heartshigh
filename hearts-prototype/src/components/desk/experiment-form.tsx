'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { Hidden } from '@/components/app/shell'

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
      <div className="body">
        {error ? <div className="flash error" role="alert" data-testid="error">{error}</div> : null}
        <Hidden fields={{ action: draft.action, id: draft.id || '', next: draft.next }} />
        <label>Key
          <input name="key" defaultValue={draft.key} required autoComplete="off" disabled={draft.existing} data-testid="experiment-key" />
        </label>
        <label>Name
          <input name="name" defaultValue={draft.name} required data-testid="experiment-name" />
        </label>
        <label>What you are testing
          <textarea name="description" defaultValue={draft.description} rows={3} />
        </label>
        <label>Slot
          <select name="slot" defaultValue={draft.slot} disabled={draft.existing} data-testid="experiment-slot-field">
            {draft.slots.map((slot) => <option key={slot.value} value={slot.value}>{slot.label}</option>)}
          </select>
        </label>
        {draft.existing ? null : (
          <label>Or type a slot key
            <input name="slotOverride" defaultValue={draft.slotOverride} placeholder="Only listed slots are allowed" data-testid="experiment-slot-key" />
          </label>
        )}
        <label>Portal
          <select name="portal" defaultValue={draft.portal}>
            <option value="">Every portal</option>
            {draft.portals.map((portal) => <option key={portal.value} value={portal.value}>{portal.label}</option>)}
          </select>
        </label>
        <label>Split
          <select name="allocation" defaultValue={draft.allocation} data-testid="experiment-allocation">
            <option value="fixed">Fixed split</option>
            <option value="auto">Auto (Thompson sampling, 10% floor)</option>
          </select>
        </label>
        <label>Primary metric
          <select name="primaryMetric" defaultValue={draft.primaryMetric} data-testid="experiment-metric">
            {draft.metrics.map((metric) => <option key={metric.value} value={metric.value}>{metric.label}</option>)}
          </select>
        </label>
        <label>Secondary metrics
          <input name="secondary" defaultValue={draft.secondary} placeholder="appetiser_complete, return_next_day" />
        </label>
        <label>Versions, one per line as <code>key | label</code>
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
