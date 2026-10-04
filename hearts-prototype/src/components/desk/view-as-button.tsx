'use client'

import { useState } from 'react'
import { HelpTip } from './help'
import { TOOL } from '@/lib/desk-help'

/** Starts a view-as session (spec 6A). A reason is required and kept in the audit log. */
export function ViewAsButton({ targetId, name, landing }: { targetId: number; name: string; landing: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const start = async () => {
    if (reason.trim().length < 10) return setError('Say why, in at least 10 characters.')
    setBusy(true)
    setError('')
    const response = await fetch('/api/view-as/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetUserId: targetId, reason: reason.trim(), returnTo: window.location.pathname + window.location.search }),
    }).catch(() => null)
    const body = (await response?.json().catch(() => null)) as { error?: string } | null
    if (!response?.ok) {
      setError(body?.error || 'That did not start. Try again.')
      setBusy(false)
      return
    }
    window.location.assign(landing)
  }
  if (!open) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <button type="button" className="btn ghost small" onClick={() => setOpen(true)} data-testid="view-as">View as</button>
        <HelpTip topic="view-as">{TOOL.viewAs}</HelpTip>
      </span>
    )
  }
  return (
    <div className="view-as-ask" data-testid="view-as-ask">
      <label className="stack">Why are you viewing as {name}?
        <input type="text" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="For example: they cannot see their course" data-testid="view-as-reason" autoFocus />
      </label>
      {error ? <p className="hint" style={{ color: '#a3324a', margin: 0 }} role="alert">{error}</p> : null}
      <div className="actions">
        <button type="button" className="btn ink small" disabled={busy} onClick={start} data-testid="view-as-start">Start, read-only</button>
        <button type="button" className="btn ghost small" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  )
}
